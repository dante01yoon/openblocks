package com.openblocks.domain.group.service;

import java.util.List;

import com.openblocks.domain.group.model.GroupMember;
import com.openblocks.domain.organization.model.MemberRole;

import reactor.core.publisher.Mono;

public interface GroupMemberService {

    Mono<List<GroupMember>> getGroupMembers(String groupId, int page, int count);

    Mono<Boolean> addMember(String orgId, String groupId, String userId, MemberRole memberRole);

    Mono<Boolean> updateMemberRole(String groupId, String userId, MemberRole memberRole);

    Mono<Boolean> removeMember(String groupId, String userId);


    /**
     * @return all group ids user belongs to
     */
    Mono<List<String>> getUserAllGroupIds(String userId);

    /**
     * @return all group ids user belongs to under specific org
     */
    Mono<List<String>> getUserGroupIdsInOrg(String orgId, String userId);

    Mono<List<GroupMember>> getUserGroupMembers(String userId);

    Mono<GroupMember> getGroupMember(String groupId, String userId);

    Mono<List<GroupMember>> getAllGroupAdmin(String groupId);

    Mono<Boolean> deleteGroupMembers(String groupId);

    Mono<Boolean> isMember(String groupId, String userId);
}
