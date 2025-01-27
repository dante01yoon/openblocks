import styled from "styled-components";
import { Input } from "antd";
import { ReactComponent as Icon } from "icons/icon-Search.svg";
import React, { CSSProperties } from "react";

const SerachInput = styled(Input)`
  margin: 0;
  padding: 0;
  height: 32px;
  width: 100%;
  border: 1px solid #d7d9e0;
  border-radius: 4px;
  font-size: 13px;
  user-select: none;
  overflow: hidden;

  :focus {
    outline: none;
    box-shadow: 0 0 0 3px #daecfc;
  }
`;
const SearchDiv = styled.div<{ error?: boolean }>`
  height: 32px;
  width: 100%;
  background: #fdfdfd;
  border-radius: 4px;
  margin-top: 16px;
  user-select: none;

  &&&&& .ant-input-affix-wrapper-focused {
    border-color: #3377ff;
    box-shadow: 0 0 0 2px rgba(51, 119, 255, 0.2);
  }

  &&&.ant-input-affix-wrapper:focus,
  .ant-input-affix-wrapper-focused {
    border-color: #3377ff;
    box-shadow: 0 0 0 2px rgba(51, 119, 255, 0.2);
  }

  .ant-input-affix-wrapper:hover {
    border-color: #8b8fa3;
  }
`;
const SearchIcon = styled(Icon)`
  margin: 6px 0 6px 8px;
`;

interface ISearch {
  style?: CSSProperties;
  placeholder: string;
  value: string;
  onChange: (value: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export const Search = (props: ISearch) => {
  const { value, onChange } = props;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange && onChange(e);
  };
  return (
    <SearchDiv style={props.style}>
      <SerachInput
        disabled={props.disabled}
        placeholder={props.placeholder}
        onChange={handleChange}
        value={value}
        prefix={<SearchIcon />}
      />
    </SearchDiv>
  );
};
