// Copyright Contributors to the Amundsen project.
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Modal } from 'react-bootstrap';
import { components } from 'react-select';
import CreatableSelect from 'react-select/lib/Creatable';

import { GlobalState } from 'ducks/rootReducer';
import { getAllTags, updateTags } from 'ducks/tags/reducer';
import {
  GetAllTags,
  GetAllTagsRequest,
  UpdateTags,
  UpdateTagsRequest,
} from 'ducks/tags/types';

import { EditableSectionChildProps } from 'components/EditableSection';
import { ResourceType, Tag, UpdateMethod, UpdateTagData } from 'interfaces';
import TagInfo from '../TagInfo';

import './styles.scss';

const VALID_TAG_REGEXP = new RegExp(/^([a-z0-9_]+)$/);
const BATCH_EDIT_TAG_OPTION = 'amundsen_batch_edit';

const FILTER_COMMON_TAGS = (otherArray) => (current) =>
  otherArray.filter((other) => other.tag_name === current.tag_name).length ===
  0;

enum BatchEditState {
  CURRENT = 'CURRENT',
  DELETE = 'DELETE',
  PUT = 'PUT',
}

export interface StateFromProps {
  allTags: Tag[];
  isLoading: boolean;
  tags: Tag[];
}

export interface OwnProps {
  resourceType: ResourceType;
  uriKey: string;
}

export interface DispatchFromProps {
  updateTags: (tagArray: UpdateTagData[]) => UpdateTagsRequest;
  getAllTags: () => GetAllTagsRequest;
}

export type TagInputProps = StateFromProps &
  OwnProps &
  DispatchFromProps &
  EditableSectionChildProps;

interface TagInputState {
  showModal: boolean;
}

export class TagInput extends React.Component<TagInputProps, TagInputState> {
  private batchEditSet: Map<string, BatchEditState> | {};

  public static defaultProps: TagInputProps = {
    allTags: [],
    getAllTags: () => ({
      type: GetAllTags.REQUEST,
    }),
    isLoading: false,
    resourceType: ResourceType.table,
    tags: [],
    updateTags: () => ({
      type: UpdateTags.REQUEST,
      payload: {
        tagArray: [],
        resourceType: ResourceType.table,
        uriKey: '',
      },
    }),
    uriKey: '',
  };

  constructor(props) {
    super(props);
    this.state = {
      showModal: false,
    };
  }

  componentDidMount() {
    const { getAllTags } = this.props;

    getAllTags();
  }

  handleClose = () => {
    this.batchEditSet = {};
    this.setState({ showModal: false });
  };

  handleShow = () => {
    const { tags } = this.props;

    this.batchEditSet = {};
    tags.map((tag) => {
      this.batchEditSet[tag.tag_name] = BatchEditState.CURRENT;
    });
    this.setState({ showModal: true });
  };

  handleSaveModalEdit = () => {
    const { updateTags } = this.props;
    const tagArray = Object.keys(this.batchEditSet).reduce(
      (previousValue: UpdateTagData[], tagName) => {
        const action = this.batchEditSet[tagName];

        if (action === BatchEditState.DELETE) {
          previousValue.push({ methodName: UpdateMethod.DELETE, tagName });
        } else if (action === BatchEditState.PUT) {
          previousValue.push({ methodName: UpdateMethod.PUT, tagName });
        }

        return previousValue;
      },
      []
    );

    updateTags(tagArray);
    this.handleClose();
  };

  generateCustomOptionStyle(provided, state) {
    // https://react-select.com/props#api
    const isSeeAll = state.value === BATCH_EDIT_TAG_OPTION;

    return {
      ...provided,
      color: isSeeAll ? 'grey' : 'inherit',
      fontStyle: isSeeAll ? 'italic' : 'inherit',
    };
  }

  isValidNewOption(inputValue) {
    // https://react-select.com/props#api
    return VALID_TAG_REGEXP.test(inputValue);
  }

  mapTagsToReactSelectAPI(tagArray) {
    return tagArray.map((tag) => ({
      value: tag.tag_name,
      label: tag.tag_name,
    }));
  }

  mapOptionsToReactSelectAPI(tagArray) {
    return [
      { value: BATCH_EDIT_TAG_OPTION, label: 'Select From All Tags...' },
    ].concat(this.mapTagsToReactSelectAPI(tagArray));
  }

  noOptionsMessage(inputValue) {
    // https://react-select.com/props#api
    if (VALID_TAG_REGEXP.test(inputValue.inputValue)) {
      return 'Tag already exists.';
    }

    return "Valid characters include a-z, 0-9, and '_'.";
  }

  onChange = (currentTags, actionPayload) => {
    // https://react-select.com/props#api
    const actionType = actionPayload.action;
    let tag;

    if (actionType === 'select-option' || actionType === 'create-option') {
      tag =
        actionType === 'select-option'
          ? actionPayload.option.value
          : currentTags[currentTags.length - 1].value;
      if (tag === BATCH_EDIT_TAG_OPTION) {
        currentTags.pop();
        this.handleShow();
      } else {
        this.props.updateTags([{ methodName: UpdateMethod.PUT, tagName: tag }]);
      }
    } else if (actionType === 'remove-value' || actionType === 'pop-value') {
      tag = actionPayload.removedValue.value;
      this.props.updateTags([
        { methodName: UpdateMethod.DELETE, tagName: tag },
      ]);
    }
  };

  onKeyDown = (event) => {
    if (event.key === 8 && event.target.value.length === 0) {
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      this.stopEditing();
    }
  };

  toggleTag = (event, tagName) => {
    const element = event.currentTarget;

    if (element.classList.contains('selected')) {
      element.classList.remove('selected');
    } else {
      element.classList.add('selected');
    }

    if (!this.batchEditSet.hasOwnProperty(tagName)) {
      this.batchEditSet[tagName] = BatchEditState.PUT;
    } else if (this.batchEditSet[tagName] === BatchEditState.PUT) {
      delete this.batchEditSet[tagName];
    } else if (this.batchEditSet[tagName] === BatchEditState.CURRENT) {
      this.batchEditSet[tagName] = BatchEditState.DELETE;
    } else if (this.batchEditSet[tagName] === BatchEditState.DELETE) {
      this.batchEditSet[tagName] = BatchEditState.CURRENT;
    }
  };

  renderTagBlob(tagArray, keyPrefix, className) {
    return tagArray.map((tag) => {
      const tagName = tag.tag_name;
      const labelProps = {
        children: tagName,
        data: { value: tagName, label: tagName },
        innerProps: { className: 'multi-value-label' },
      };
      const updateTag = (event) => {
        this.toggleTag(event, tagName);
      };

      return (
        <div
          onClick={updateTag}
          key={`${keyPrefix}:${tagName}`}
          className={className}
        >
          <components.MultiValueContainer>
            <components.MultiValueLabel {...labelProps} />
          </components.MultiValueContainer>
        </div>
      );
    });
  }

  renderModalBody() {
    const { tags, allTags } = this.props;

    return (
      <div className="">
        <p className="">Click on a tag to add/remove</p>
        <div className="tag-blob">
          {this.renderTagBlob(
            tags,
            'current',
            'multi-value-container selected'
          )}
          {this.renderTagBlob(
            allTags.filter(FILTER_COMMON_TAGS(tags)),
            'existing',
            'multi-value-container'
          )}
        </div>
      </div>
    );
  }

  startEditing = () => {
    const { setEditMode } = this.props;

    if (setEditMode) {
      setEditMode(true);
    }
  };

  stopEditing = () => {
    const { setEditMode } = this.props;

    if (setEditMode) {
      setEditMode(false);
    }
  };

  render() {
    const { isEditing, tags, isLoading, allTags } = this.props;
    const { showModal } = this.state;

    // https://react-select.com/props#api
    const componentOverides = !isEditing
      ? {
          DropdownIndicator: () => null,
          IndicatorSeparator: () => null,
          MultiValueRemove: () => null,
        }
      : {
          DropdownIndicator: () => null,
          IndicatorSeparator: () => null,
        };

    let tagBody;

    if (!isEditing) {
      if (tags.length === 0) {
        tagBody = (
          <button
            className="btn btn-default muted add-btn"
            onClick={this.startEditing}
            title="New"
            type="button"
          >
            <img className="icon icon-plus" alt="" />
            New
          </button>
        );
      } else {
        tagBody = tags.map((tag, index) => <TagInfo data={tag} key={index} />);
      }
    } else {
      tagBody = (
        <CreatableSelect
          autoFocus
          className="basic-multi-select"
          classNamePrefix="amundsen"
          components={componentOverides}
          isClearable={false}
          isDisabled={isLoading}
          isLoading={isLoading}
          isMulti
          isValidNewOption={this.isValidNewOption}
          name="tags"
          noOptionsMessage={this.noOptionsMessage}
          onChange={this.onChange}
          onKeyDown={this.onKeyDown}
          options={this.mapOptionsToReactSelectAPI(allTags)}
          placeholder="Add a new tag"
          styles={{
            multiValueLabel: (provided) => ({
              ...provided,
              fontSize: '14px',
              height: '30px',
              lineHeight: '24px',
              width: '100%',
            }),
            option: this.generateCustomOptionStyle,
          }}
          value={this.mapTagsToReactSelectAPI(tags)}
        />
      );
    }

    return (
      <div className="tag-input">
        {tagBody}
        <Modal
          className="tag-input-modal"
          show={showModal}
          onHide={this.handleClose}
        >
          <Modal.Header className="text-center" closeButton={false}>
            <Modal.Title>Add/Remove Tags</Modal.Title>
          </Modal.Header>
          <Modal.Body>{this.renderModalBody()}</Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-default"
              onClick={this.handleClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.handleSaveModalEdit}
            >
              Save
            </button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export const mapStateToProps = (state: GlobalState) => ({
  allTags: state.tags.allTags.tags,
  isLoading: state.tags.allTags.isLoading || state.tags.resourceTags.isLoading,
  tags: state.tags.resourceTags.tags,
});

export const mapDispatchToProps = (dispatch: any, ownProps: OwnProps) =>
  bindActionCreators(
    {
      getAllTags,
      updateTags: (tags: UpdateTagData[]) =>
        updateTags(tags, ownProps.resourceType, ownProps.uriKey),
    },
    dispatch
  );

export default connect<StateFromProps, DispatchFromProps, OwnProps>(
  mapStateToProps,
  mapDispatchToProps
)(TagInput);
