import React, { Component, Fragment } from 'react';
import moment from 'moment';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Loading from '../../../components/loading';
import { gettext, historyRepoID, PER_PAGE } from '../../../utils/constants';
import { seafileAPI } from '../../../utils/seafile-api';
import { Utils } from '../../../utils/utils';
import editUtilities from '../../../utils/editor-utilities';
import toaster from '../../../components/toast';
import HistoryVersion from './history-version';
import Switch from '../../../components/common/switch';

moment.locale(window.app.config.lang);

const { docUuid } = window.fileHistory.pageOptions;

class SidePanel extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      historyGroups: [],
      errorMessage: '',
      hasMore: false,
      fileOwner: '',
      isReloadingData: false,
    };
    this.currentPage = 1;
  }

  // listSdocDailyHistoryDetail

  componentDidMount() {
    this.firstLoadSdocHistory();
  }

  firstLoadSdocHistory() {
    this.currentPage = 1;
    seafileAPI.listSdocHistory(docUuid, this.currentPage, PER_PAGE).then(res => {
      const result = res.data;
      const resultCount = result.histories.length;
      this.setState({
        historyGroups: this.formatHistories(result.histories),
        hasMore: resultCount >= PER_PAGE,
        isLoading: false,
        fileOwner: result.histories[0].creator_email,
      });
      if (result.histories[0]) {
        this.props.onSelectHistoryVersion(result.histories[0], result.histories[1]);
      }
    }).catch((error) => {
      this.setState({isLoading: false});
      throw Error('there has an error in server');
    });
  }

  formatHistories(histories) {
    const oldHistoryGroups = this.state.historyGroups;
    if (!Array.isArray(histories) || histories.length === 0) return oldHistoryGroups;
    const newHistoryGroups = oldHistoryGroups.slice(0);
    histories.forEach(history => {
      const { date } = history;
      const momentDate = moment(date);
      const month = momentDate.format('YYYY-MM');
      const monthItem = newHistoryGroups.find(item => item.month === month);
      if (monthItem) {
        monthItem.children.push({ day: momentDate.format('YYYY-MM-DD'), showDaily: false, children: [ history ] });
      } else {
        newHistoryGroups.push({
          month,
          children: [
            { day: momentDate.format('YYYY-MM-DD'), showDaily: false, children: [ history ] }
          ]
        });
      }
    });
    return newHistoryGroups;
  }

  updateResultState(result) {
    const resultCount = result.histories.length;
    this.setState({
      historyGroups: this.formatHistories(result.histories),
      hasMore: resultCount >= PER_PAGE,
      isLoading: false,
      fileOwner: result.histories[0].creator_email,
    });
  }

  loadMore = () => {
    if (!this.state.isReloadingData) {
      this.currentPage = this.currentPage + 1;
      this.setState({ isReloadingData: true }, () => {
        seafileAPI.listSdocHistory(docUuid, this.currentPage, PER_PAGE).then(res => {
          this.updateResultState(res.data);
          this.setState({isReloadingData: false});
        });
      });
    }
  };

  renameHistoryVersion = (objID, newName) => {
    seafileAPI.renameSdocHistory(docUuid, objID, newName).then((res) => {
      this.setState({
        historyGroups: this.state.historyGroups.map(item => {
          if (item.obj_id == objID) {
            item.name = newName;
          }
          return item;
        })
      });
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error, true);
      this.setState({ isLoading: false, errorMessage: errorMessage });
    });
  };

  onScrollHandler = (event) => {
    const clientHeight = event.target.clientHeight;
    const scrollHeight = event.target.scrollHeight;
    const scrollTop = event.target.scrollTop;
    const isBottom = (clientHeight + scrollTop + 1 >= scrollHeight);
    if (isBottom && this.state.hasMore) {
      this.loadMore();
    }
  };

  restoreVersion = (currentItem) => {
    const { commit_id, path } = currentItem;
    editUtilities.revertFile(path, commit_id).then(res => {
      if (res.data.success) {
        this.setState({isLoading: true}, () => {
          this.firstLoadSdocHistory();
        });
      }
      let message = gettext('Successfully restored.');
      toaster.success(message);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error, true);
      toaster.danger(gettext(errorMessage));
    });
  };

  onSelectHistoryVersion = (path) => {
    const { isShowChanges } = this.props;
    const { historyGroups } = this.state;
    const historyVersion = historyGroups[path[0]].children[path[1]].children[path[2]];
    this.props.onSelectHistoryVersion(historyVersion, isShowChanges);
  };

  copyHistoryFile = (historyVersion) => {
    const { path, obj_id, ctime_format } = historyVersion;
    seafileAPI.sdocCopyHistoryFile(historyRepoID, path, obj_id, ctime_format).then(res => {
      let message = gettext('Successfully copied %(name)s.');
      let filename = res.data.file_name;
      message = message.replace('%(name)s', filename);
      toaster.success(message);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error, true);
      toaster.danger(gettext(errorMessage));
    });
  };

  showDailyHistory = (path, callback) => {
    const { historyGroups } = this.state;
    const newHistoryGroups = historyGroups.slice(0);
    const dayHistoryGroup = newHistoryGroups[path[0]].children[path[1]];
    if (dayHistoryGroup.showDaily) {
      dayHistoryGroup.showDaily = false;
      this.setState({ historyGroups: newHistoryGroups }, () => {
        callback && callback();
      });
      return;
    }
    if (dayHistoryGroup.children.length > 1) {
      dayHistoryGroup.showDaily = true;
      this.setState({ historyGroups: newHistoryGroups }, () => {
        callback && callback();
      });
      return;
    }

    seafileAPI.listSdocDailyHistoryDetail(docUuid, dayHistoryGroup.children[0].ctime).then(res => {
      const histories = res.data.histories;
      dayHistoryGroup.children.push(...histories);
      dayHistoryGroup.showDaily = true;
      this.setState({ historyGroups: newHistoryGroups }, () => {
        callback && callback();
      });
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error, true);
      toaster.danger(gettext(errorMessage));
    });
  };

  renderHistoryVersions = () => {
    const { isLoading, historyGroups, errorMessage } = this.state;
    if (historyGroups.length === 0) {
      if (isLoading) {
        return (
          <div className="h-100 w-100 d-flex align-items-center justify-content-center">
            <Loading />
          </div>
        );
      }
      if (errorMessage) {
        return (
          <div className="h-100 w-100 d-flex align-items-center justify-content-center error-message">
            {gettext(errorMessage)}
          </div>
        );
      }
      return (
        <div className="h-100 w-100 d-flex align-items-center justify-content-center empty-tip-color">
          {gettext('No version history')}
        </div>
      );
    }

    return (
      <>
        {historyGroups.map((monthHistoryGroup, historyGroupIndex) => {
          return (
            <Fragment key={monthHistoryGroup.month}>
              <div className="history-list-item history-month-title" key={monthHistoryGroup.month}>{monthHistoryGroup.month}</div>
              {monthHistoryGroup.children.map((dayHistoryGroup, dayHistoryGroupIndex) => {
                const { children, showDaily } = dayHistoryGroup;
                const displayHistories = showDaily ? children : children.slice(0, 1);
                return displayHistories.map((history, index) => {
                  return (
                    <HistoryVersion
                      key={history.commit_id}
                      path={[historyGroupIndex, dayHistoryGroupIndex, index]}
                      showDaily={index === 0 && showDaily}
                      currentVersion={this.props.currentVersion}
                      historyVersion={history}
                      onSelectHistoryVersion={this.onSelectHistoryVersion}
                      onRestore={this.restoreVersion}
                      onCopy={this.copyHistoryFile}
                      renameHistoryVersion={this.renameHistoryVersion}
                      showDailyHistory={this.showDailyHistory}
                    />
                  );
                });
              }).flat()}
            </Fragment>
          );
        })}
        {isLoading && (
          <div className="loading-more d-flex align-items-center justify-content-center w-100">
            <Loading />
          </div>
        )}
      </>
    );
  };

  onShowChanges = () => {
    const { isShowChanges } = this.props;
    this.props.onShowChanges(!isShowChanges);
  };

  render() {
    const { historyGroups } = this.state;

    return (
      <div className="sdoc-file-history-panel h-100 o-hidden d-flex flex-column">
        <div className="sdoc-file-history-select-range">
          <div className="sdoc-file-history-select-range-title">
            {gettext('History Versions')}
          </div>
        </div>
        <div
          className={classnames('sdoc-file-history-versions', { 'o-hidden': historyGroups.length === 0 } )}
          onScroll={this.onScrollHandler}
        >
          {this.renderHistoryVersions()}
        </div>
        <div className="sdoc-file-history-diff-switch d-flex align-items-center">
          <Switch
            checked={this.props.isShowChanges}
            placeholder={gettext('Show changes')}
            className="sdoc-history-show-changes w-100"
            size="small"
            onChange={this.onShowChanges}
          />
        </div>
      </div>
    );
  }
}

SidePanel.propTypes = {
  isShowChanges: PropTypes.bool,
  currentVersion: PropTypes.object,
  onSelectHistoryVersion: PropTypes.func,
  onShowChanges: PropTypes.func,
};

export default SidePanel;
