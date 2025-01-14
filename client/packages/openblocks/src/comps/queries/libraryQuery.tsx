import { simpleMultiComp, stateComp, valueComp } from "../generators";
import {
  changeChildAction,
  CompAction,
  CompParams,
  customAction,
  isMyCustomAction,
  wrapChildAction,
} from "openblocks-core";
import React, { Fragment, useEffect } from "react";
import {
  parseChildrenFromValueAndChildrenMap,
  ToDataType,
  ToInstanceType,
} from "../generators/multi";
import { setFieldsNoTypeCheck } from "../../util/objectUtils";
import {
  Dropdown,
  QueryConfigLabel,
  QueryConfigWrapper,
  QueryTutorialButton,
} from "openblocks-design";
import { useDispatch, useSelector } from "react-redux";
import {
  getQueryLibraryDropdownInfo,
  getQueryLibraryRecordsDSL,
} from "../../redux/selectors/queryLibrarySelectors";
import { fetchQueryLibraryRecordDSL } from "../../redux/reduxActions/queryLibraryActions";
import { toQueryView } from "./queryCompUtils";
import { JSONValueControl } from "../controls/codeControl";
import styled from "styled-components";
import { getBottomResIcon } from "@openblocks-ee/util/bottomResUtils";
import { GreyTextColor } from "../../constants/style";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { trans } from "i18n";

const NoInputsWrapper = styled.div`
  color: ${GreyTextColor};
  font-size: 12px;
`;

interface InputItem {
  name: string;
  description: string;
}

const InputsComp = class extends simpleMultiComp({}) {
  params: any = {};
  inputs: InputItem[] = [];

  constructor(params: CompParams<any>) {
    super(params);
    this.params = params;
  }

  override parseChildrenFromValue(params: CompParams<Record<string, string>>) {
    const childrenMap: any = {};
    Object.entries(params.value ?? {}).forEach((t) => {
      const dispatchChild = (action: CompAction): void => {
        params.dispatch && params.dispatch(wrapChildAction(t[0], action));
      };
      return (childrenMap[t[0]] = new JSONValueControl({ dispatch: dispatchChild, value: t[1] }));
    });
    return childrenMap;
  }

  getView() {
    return this.children;
  }

  getPropertyView() {
    if (this.inputs.length === 0) {
      return (
        <QueryConfigWrapper>
          <QueryConfigLabel />
          <NoInputsWrapper>{trans("queryLibrary.noInput")}</NoInputsWrapper>
        </QueryConfigWrapper>
      );
    }
    return this.inputs.map(({ name, description }) => {
      const child = this.children[name];
      if (!child) {
        return null;
      }
      return (
        <Fragment key={name}>
          {(child as any).propertyView({
            label: name,
            tooltip: description,
            placement: "bottom",
          })}
        </Fragment>
      );
    });
  }

  setInputs(inputs: InputItem[]) {
    const childrenMap: any = {};
    inputs.forEach(({ name }) => {
      childrenMap[name] = JSONValueControl;
    });
    const children = parseChildrenFromValueAndChildrenMap(
      { ...this.params, value: { ...this.params.value, ...this.toJsonValue() } },
      childrenMap
    );
    return setFieldsNoTypeCheck(this, {
      children: children,
      inputs,
    });
  }
};

type QueryLibraryUpdateAction = {
  type: "queryLibraryUpdate";
  dsl: any;
};

const childrenMap = {
  libraryQueryId: valueComp<string>(""),
  libraryQueryRecordId: valueComp<string>("latest"),
  inputs: InputsComp,
  error: stateComp<string>(""),
};

const LibraryQueryBase = simpleMultiComp(childrenMap);

type DataType = ToDataType<ToInstanceType<typeof childrenMap>>;

export const LibraryQuery = class extends LibraryQueryBase {
  readonly isReady: boolean = false;

  private value: DataType | undefined;

  constructor(params: CompParams<DataType>) {
    super(params);
    this.value = params.value;
  }

  override getView() {
    return toQueryView(
      Object.entries(this.children.inputs.children).map(([name, input]) => ({
        key: name,
        value: () => input.getView(),
      }))
    );
  }

  override getPropertyView() {
    return <PropertyView comp={this} />;
  }

  override toJsonValue() {
    if (this.isReady) {
      return super.toJsonValue();
    }
    return { ...super.toJsonValue(), inputs: this.value?.inputs };
  }

  override reduce(action: CompAction): this {
    if (isMyCustomAction<QueryLibraryUpdateAction>(action, "queryLibraryUpdate")) {
      const inputs = this.children.inputs.setInputs(action.value?.dsl?.["inputs"] ?? []);
      return setFieldsNoTypeCheck(this, {
        children: { ...this.children, inputs: inputs },
        isReady: true,
      });
    }
    return super.reduce(action);
  }
};

const PropertyView = (props: { comp: InstanceType<typeof LibraryQuery> }) => {
  const { children, dispatch } = props.comp;
  const queryId = children.libraryQueryId.getView();
  const recordId = children.libraryQueryRecordId.getView();

  const reduxDispatch = useDispatch();
  const queryLibraryMeta = useSelector(getQueryLibraryDropdownInfo);
  const queryLibraryRecord = useSelector(getQueryLibraryRecordsDSL);

  const info = queryLibraryRecord[queryId]?.[recordId];

  useEffect(() => {
    dispatch(customAction<QueryLibraryUpdateAction>({ type: "queryLibraryUpdate", dsl: info }));
  }, [info]);

  useEffect(() => {
    if (queryId && recordId) {
      reduxDispatch(
        fetchQueryLibraryRecordDSL({
          libraryQueryId: queryId,
          libraryQueryRecordId: recordId,
          onErrorCallback: (error) => children.error.dispatchChangeValueAction(error.message),
        })
      );
    }
  }, [queryId, recordId, dispatch]);

  useEffect(() => {
    const firstLibraryQueryId = Object.values(queryLibraryMeta)[0]?.libraryQueryMetaView.id;
    if (!queryId && firstLibraryQueryId) {
      dispatch(changeChildAction("libraryQueryId", firstLibraryQueryId));
    }
  }, []);

  const getInputsView = () => {
    if (!queryId) {
      return null;
    }

    if (!info) {
      if (children.error.getView()) {
        return (
          <QueryConfigWrapper>
            <QueryConfigLabel />
            <NoInputsWrapper style={{ color: "#ff4d4f" }}>
              {children.error.getView()}
            </NoInputsWrapper>
          </QueryConfigWrapper>
        );
      } else {
        return <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />;
      }
    } else {
      return children.inputs.getPropertyView();
    }
  };

  return (
    <>
      <QueryConfigWrapper>
        <QueryConfigLabel>{trans("queryLibrary.chooseQuery")}</QueryConfigLabel>
        <div style={{ width: "184px", flexGrow: 1 }}>
          <Dropdown
            options={Object.values(queryLibraryMeta).map((meta) => ({
              label: (
                <QueryLabelWrapper>
                  {getBottomResIcon(
                    meta.recordMetaViewList?.find((t) => t.id === recordId)?.datasourceType ??
                      meta.recordMetaViewList?.[0]?.datasourceType ??
                      meta.libraryQueryMetaView.datasourceType
                  )}
                  {meta.libraryQueryMetaView.name}
                </QueryLabelWrapper>
              ),
              value: meta.libraryQueryMetaView.id,
            }))}
            value={queryId ?? queryLibraryMeta[0]?.libraryQueryMetaView.id}
            onChange={(value) => dispatch(changeChildAction("libraryQueryId", value))}
          />
        </div>
        <QueryTutorialButton
          label={trans("queryLibrary.viewQuery")}
          url={`/query-library?forwardQueryId=${queryId}`}
          styleName={"dropdownRight"}
        />
      </QueryConfigWrapper>

      <Dropdown
        label={trans("queryLibrary.chooseVersion")}
        placement={"bottom"}
        options={[
          { label: trans("queryLibrary.latest"), value: "latest" },
          ...(queryLibraryMeta[queryId]?.recordMetaViewList?.map((meta) => ({
            label: meta.tag,
            value: meta.id,
          })) ?? []),
        ]}
        value={recordId}
        onChange={(value) => dispatch(changeChildAction("libraryQueryRecordId", value))}
      />

      {getInputsView()}
    </>
  );
};

const QueryLabelWrapper = styled.div`
  display: flex;
  align-items: center;
`;
