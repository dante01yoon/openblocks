import { withPropertyViewFn, withTypeAndChildren } from "comps/generators";
import { Dropdown, ValueFromOption } from "openblocks-design";
import { CompAction, changeValueAction } from "openblocks-core";
import { CompConstructor } from "openblocks-core";
import { dropdownControl } from "../controls/dropdownControl";
import {
  ParamsJsonControl,
  ParamsPositiveNumberControl,
  ParamsStringControl,
} from "../controls/paramsControl";
import { buildQueryCommand, FunctionProperty, toQueryView } from "./queryCompUtils";
import { includes } from "lodash";

const CommandOptions = [
  { label: "Find Document(s)", value: "FIND" },
  { label: "Insert Document(s)", value: "INSERT" },
  { label: "Update Document(s)", value: "UPDATE" },
  { label: "Delete Document(s)", value: "DELETE" },
  { label: "Count", value: "COUNT" },
  { label: "Distinct", value: "DISTINCT" },
  { label: "Aggregate", value: "AGGREGATE" },
  { label: "Raw", value: "RAW" },
] as const;

const LimitOptions = [
  {
    label: "Single Document",
    value: "SINGLE",
  },
  {
    label: "All Matching Documents",
    value: "ALL",
  },
] as const;

const CommandMap: Record<
  ValueFromOption<typeof CommandOptions>,
  CompConstructor<FunctionProperty[]>
> = {
  FIND: buildQueryCommand({
    query: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Query",
        placement: "bottom",
        placeholder: `{
  rating : {$gte : 9}
}`,
        styleName: "medium",
      })
    ),
    projection: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Projection",
        placement: "bottom",
        placeholder: "{name : 1}",
      })
    ),
    limit: withPropertyViewFn(ParamsPositiveNumberControl, (comp) =>
      comp.propertyView({
        label: "Limit",
        placement: "bottom",
        placeholder: "10",
      })
    ),
    skip: withPropertyViewFn(ParamsPositiveNumberControl, (comp) =>
      comp.propertyView({
        label: "Skip",
        placement: "bottom",
        placeholder: "0",
      })
    ),
    sort: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Sort",
        placement: "bottom",
        placeholder: "{name : 1}",
      })
    ),
  }),
  INSERT: buildQueryCommand({
    documents: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Documents",
        placement: "bottom",
        placeholder: `[{ 
    _id: 1, 
    user: "abc123", 
}]`,
        styleName: "medium",
      })
    ),
  }),
  UPDATE: buildQueryCommand({
    query: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Query",
        placement: "bottom",
        placeholder: `{
  rating : {$gte : 9}
}`,
        styleName: "medium",
      })
    ),
    update: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Update",
        placement: "bottom",
        placeholder: `{
  $inc : {score: 1}
}`,
        styleName: "medium",
      })
    ),
    limit: withPropertyViewFn(dropdownControl(LimitOptions, "SINGLE"), (comp) => (
      <>{comp.propertyView({ label: "Limit", placement: "bottom" })}</>
    )),
  }),
  DELETE: buildQueryCommand({
    query: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Query",
        placement: "bottom",
        placeholder: `{
  rating : {$gte : 9}
}`,
        styleName: "medium",
      })
    ),
    limit: withPropertyViewFn(dropdownControl(LimitOptions, "SINGLE"), (comp) => (
      <>{comp.propertyView({ label: "Limit", placement: "bottom" })}</>
    )),
  }),
  COUNT: buildQueryCommand({
    query: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Query",
        placement: "bottom",
        placeholder: `{
  rating : {$gte : 9}
}`,
        styleName: "medium",
      })
    ),
  }),
  DISTINCT: buildQueryCommand({
    query: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Query",
        placement: "bottom",
        placeholder: `{
  rating : {$gte : 9}
}`,
        styleName: "medium",
      })
    ),
    key: withPropertyViewFn(ParamsStringControl, (comp) =>
      comp.propertyView({
        label: "Key",
        placement: "bottom",
        placeholder: "name",
      })
    ),
  }),
  AGGREGATE: buildQueryCommand({
    arrayPipelines: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Array Pipelines",
        placement: "bottom",
        placeholder: `[
  { $match: { gender: "male" } },
  { $group: { _id: "$team", count: { $sum: 1 } } }
]`,
        styleName: "medium",
      })
    ),
    limit: withPropertyViewFn(ParamsPositiveNumberControl, (comp) =>
      comp.propertyView({
        label: "Limit",
        placement: "bottom",
        placeholder: "10",
      })
    ),
  }),
  RAW: buildQueryCommand({
    command: withPropertyViewFn(ParamsJsonControl, (comp) =>
      comp.propertyView({
        label: "Command",
        placement: "bottom",
        placeholder: `[
  { $project: { tags: 1 } }, { $unwind: "$tags" }, 
  { $group: { _id: "$tags", count: { $sum : 1 }}}
]`,
        styleName: "medium",
      })
    ),
  }),
};

const MongoQueryTmp = withTypeAndChildren(CommandMap, "FIND", {
  collection: withPropertyViewFn(ParamsStringControl, (comp) =>
    comp.propertyView({ placeholder: "users" })
  ),
});

export class MongoQuery extends MongoQueryTmp {
  isWrite(action: CompAction): boolean {
    return (
      "value" in action && includes(["INSERT", "UPDATE", "DELETE", "RAW"], action.value["compType"])
    );
  }

  override getView() {
    const params = [
      ...Object.entries(this.children.collection.getView()).map((kv) => ({
        key: kv[0],
        value: kv[1] as Function,
      })),
      ...this.children.comp.getView(),
    ];
    return toQueryView(params);
  }

  override getPropertyView() {
    return (
      <>
        <Dropdown
          label={"Commands"}
          placement={"bottom"}
          options={CommandOptions}
          value={this.children.compType.getView()}
          onChange={(value) => this.dispatch(changeValueAction({ compType: value, comp: {} }))}
        />

        {this.children.compType.getView() !== "RAW" && (
          <>
            {this.children.collection.propertyView({
              label: "Collection",
              placement: "bottom",
            })}
          </>
        )}

        {this.children.comp.getPropertyView()}
      </>
    );
  }
}
