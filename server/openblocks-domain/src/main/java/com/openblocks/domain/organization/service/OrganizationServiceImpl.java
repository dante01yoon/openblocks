package com.openblocks.domain.organization.service;


import static com.openblocks.domain.organization.model.OrganizationState.ACTIVE;
import static com.openblocks.domain.util.QueryDslUtils.fieldName;
import static com.openblocks.sdk.exception.BizError.UNABLE_TO_FIND_VALID_ORG;
import static com.openblocks.sdk.util.ExceptionUtils.deferredError;
import static com.openblocks.sdk.util.LocaleUtils.getLocale;
import static com.openblocks.sdk.util.LocaleUtils.getMessage;

import java.util.Collection;
import java.util.Locale;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.codec.multipart.Part;
import org.springframework.stereotype.Service;

import com.openblocks.domain.asset.model.Asset;
import com.openblocks.domain.asset.service.AssetRepository;
import com.openblocks.domain.asset.service.AssetService;
import com.openblocks.domain.datasource.model.Datasource;
import com.openblocks.domain.datasource.model.DatasourceCreationSource;
import com.openblocks.domain.datasource.service.DatasourceService;
import com.openblocks.domain.group.service.GroupService;
import com.openblocks.domain.organization.event.OrgDeletedEvent;
import com.openblocks.domain.organization.model.MemberRole;
import com.openblocks.domain.organization.model.Organization;
import com.openblocks.domain.organization.model.Organization.OrganizationCommonSettings;
import com.openblocks.domain.organization.model.OrganizationState;
import com.openblocks.domain.organization.model.QOrganization;
import com.openblocks.domain.organization.repository.OrganizationRepository;
import com.openblocks.domain.plugin.DatasourceMetaInfoConstants;
import com.openblocks.domain.user.model.User;
import com.openblocks.infra.mongo.MongoUpsertHelper;
import com.openblocks.sdk.config.dynamic.Conf;
import com.openblocks.sdk.config.dynamic.ConfigCenter;
import com.openblocks.sdk.constants.FieldName;
import com.openblocks.sdk.exception.BizError;
import com.openblocks.sdk.exception.BizException;
import com.openblocks.sdk.plugin.openblocksapi.OpenblocksApiDatasourceConfig;
import com.openblocks.sdk.plugin.restapi.RestApiDatasourceConfig;

import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Slf4j
@Service
public class OrganizationServiceImpl implements OrganizationService {

    private final Conf<Integer> logoMaxSizeInKb;

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private AssetService assetService;

    @Autowired
    private OrgMemberService orgMemberService;

    @Autowired
    private MongoUpsertHelper mongoUpsertHelper;

    @Autowired
    private OrganizationRepository repository;

    @Autowired
    private DatasourceService datasourceService;

    @Autowired
    private GroupService groupService;

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    public OrganizationServiceImpl(ConfigCenter configCenter) {
        logoMaxSizeInKb = configCenter.asset().ofInteger("logoMaxSizeInKb", 300);
    }

    @Override
    public Mono<Organization> createDefault(User user) {
        return Mono.deferContextual(contextView -> {
            Locale locale = getLocale(contextView);
            String userOrgSuffix = getMessage(locale, "USER_ORG_SUFFIX");

            Organization organization = new Organization();
            organization.setName(user.getName() + userOrgSuffix);
            organization.setIsAutoGeneratedOrganization(true);
            return create(organization, user.getId());
        });
    }

    @Override
    public Mono<Organization> create(Organization organization, String creatorId) {

        return Mono.defer(() -> {
                    if (organization == null || StringUtils.isNotBlank(organization.getId())) {
                        return Mono.error(new BizException(BizError.INVALID_PARAMETER, "INVALID_PARAMETER", FieldName.ORGANIZATION));
                    }
                    organization.setState(ACTIVE);
                    return Mono.just(organization);
                })
                .flatMap(repository::save)
                .flatMap(newOrg -> onOrgCreated(creatorId, newOrg))
                .log();
    }

    private Mono<Organization> onOrgCreated(String userId, Organization newOrg) {
        return createEmptyRestDatasource(newOrg, userId)
                .then(createOpenblocksApiDatasource(newOrg, userId))
                .then(groupService.createAllUserGroup(newOrg.getId()))
                .then(groupService.createDevGroup(newOrg.getId()))
                .then(setOrgAdmin(userId, newOrg))
                .thenReturn(newOrg);
    }


    private Mono<Void> createEmptyRestDatasource(Organization newOrg, String userId) {
        return Mono.deferContextual(contextView -> {
            Locale locale = getLocale(contextView);
            String restQueryName = getMessage(locale, "DEFAULT_REST_DATASOURCE_NAME");
            Datasource emptyHttpDatasource = new Datasource();
            emptyHttpDatasource.setName(restQueryName);
            emptyHttpDatasource.setType(DatasourceMetaInfoConstants.REST_API);
            emptyHttpDatasource.setOrganizationId(newOrg.getId());
            emptyHttpDatasource.setDetailConfig(RestApiDatasourceConfig.EMPTY_CONFIG);
            emptyHttpDatasource.setCreationSource(DatasourceCreationSource.SYSTEM_PREDEFINED.getValue());
            return datasourceService.create(emptyHttpDatasource, userId)
                    .then();
        });
    }

    private Mono<Void> createOpenblocksApiDatasource(Organization newOrg, String userId) {
        return Mono.deferContextual(contextView -> {
            String name = getMessage(getLocale(contextView), "DEFAULT_OPENBLOCKS_DATASOURCE_NAME");
            Datasource currentOrgDatasource = new Datasource();
            currentOrgDatasource.setName(name);
            currentOrgDatasource.setType(DatasourceMetaInfoConstants.OPENBLOCKS_API);
            currentOrgDatasource.setOrganizationId(newOrg.getId());

            currentOrgDatasource.setDetailConfig(OpenblocksApiDatasourceConfig.INSTANCE);
            currentOrgDatasource.setCreationSource(DatasourceCreationSource.SYSTEM_PREDEFINED.getValue());
            return datasourceService.create(currentOrgDatasource, userId)
                    .then();
        });
    }

    private Mono<Boolean> setOrgAdmin(String userId, Organization newOrg) {
        return orgMemberService.addMember(newOrg.getId(), userId, MemberRole.ADMIN);
    }

    @Override
    public Mono<Organization> getById(String id) {
        return repository.findByIdAndState(id, ACTIVE)
                .switchIfEmpty(deferredError(UNABLE_TO_FIND_VALID_ORG, "INVALID_ORG_ID"));
    }

    @Override
    public Mono<OrganizationCommonSettings> getOrgCommonSettings(String orgId) {
        return repository.findByIdAndState(orgId, ACTIVE)
                .switchIfEmpty(deferredError(UNABLE_TO_FIND_VALID_ORG, "INVALID_ORG_ID"))
                .map(Organization::getCommonSettings);
    }

    @Override
    public Flux<Organization> getByIds(Collection<String> ids) {
        return repository.findByIdInAndState(ids, ACTIVE);
    }

    @Override
    public Mono<Boolean> uploadLogo(String organizationId, Part filePart) {

        Mono<Asset> uploadAssetMono = assetService.upload(filePart, logoMaxSizeInKb.get(), false);

        return uploadAssetMono
                .flatMap(uploadedAsset -> {
                    Organization organization = new Organization();
                    final String prevAssetId = organization.getLogoAssetId();
                    organization.setLogoAssetId(uploadedAsset.getId());

                    return mongoUpsertHelper.updateById(organization, organizationId)
                            .flatMap(updateResult -> {
                                if (StringUtils.isEmpty(prevAssetId)) {
                                    return Mono.just(updateResult);
                                }
                                return assetService.remove(prevAssetId).thenReturn(updateResult);
                            });
                });
    }

    @Override
    public Mono<Boolean> deleteLogo(String organizationId) {
        return repository.findByIdAndState(organizationId, ACTIVE)
                .flatMap(organization -> {
                    // delete from asset repo.
                    final String prevAssetId = organization.getLogoAssetId();
                    if (StringUtils.isBlank(prevAssetId)) {
                        return Mono.error(new BizException(BizError.NO_RESOURCE_FOUND, "ASSET_NOT_FOUND", ""));
                    }
                    return assetRepository.findById(prevAssetId)
                            .switchIfEmpty(Mono.error(new BizException(BizError.NO_RESOURCE_FOUND, "ASSET_NOT_FOUND", prevAssetId)))
                            .flatMap(asset -> assetRepository.delete(asset));
                })
                .then(Mono.defer(() -> {
                    // update org.
                    Organization organization = new Organization();
                    organization.setLogoAssetId(null);
                    return mongoUpsertHelper.updateById(organization, organizationId);
                }));
    }

    @Override
    public Mono<Boolean> update(String orgId, Organization updateOrg) {
        return mongoUpsertHelper.updateById(updateOrg, orgId);
    }

    @Override
    public Mono<Boolean> delete(String orgId) {
        Organization organization = new Organization();
        organization.setState(OrganizationState.DELETED);
        return mongoUpsertHelper.updateById(organization, orgId)
                .delayUntil(success -> {
                    if (success) {
                        return sendOrgDeletedEvent(orgId);
                    }
                    return Mono.empty();
                });
    }

    private Mono<Void> sendOrgDeletedEvent(String orgId) {
        OrgDeletedEvent event = new OrgDeletedEvent();
        event.setOrgId(orgId);
        applicationContext.publishEvent(event);
        return Mono.empty();
    }

    @Override
    public Mono<Organization> getBySourceAndTpCompanyId(String source, String companyId) {
        return repository.findBySourceAndThirdPartyCompanyIdAndState(source, companyId, ACTIVE);
    }

    @Override
    public Mono<Organization> getByDomain(String domain) {
        return repository.findByOrganizationDomain_DomainAndState(domain, ACTIVE);
    }

    @Override
    public Mono<Boolean> updateCommonSettings(String orgId, String key, Object value) {
        Update update = Update.update(fieldName(QOrganization.organization.commonSettings) + "." + key, value);
        return mongoUpsertHelper.upsert(update, FieldName.ID, orgId, Organization.class);
    }
}
