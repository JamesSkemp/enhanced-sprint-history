import * as React from "react";
import "./IterationHistoryDisplay.scss";

import { TeamSettingsIteration } from "azure-devops-extension-api/Work";
import { IHubWorkItemHistory, IHubWorkItemIterationRevisions, ITypedWorkItem, ITypedWorkItemChangeData, ITypedWorkItemWithRevision } from "./HubInterfaces";
import { getFlattenedRelevantRevisions, getIterationRelevantWorkItems, getTypedWorkItem } from "./HubUtils";
import { Card } from "azure-devops-ui/Card";
import { CategoryScale, ChartData, Chart as ChartJs, LineElement, LinearScale, Point, PointElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { Tab, TabBar } from "azure-devops-ui/Tabs";
import { WorkItemType } from "azure-devops-extension-api/WorkItemTracking";
import { WorkItemTypeIconDisplay } from "./WorkItemTypeIconDisplay";

ChartJs.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

export interface IterationHistoryDisplayProps {
	iteration: TeamSettingsIteration | undefined;
	projectWorkItemTypes: WorkItemType[];
	workItemHistory: IHubWorkItemHistory[];
	doneLoading: boolean;
	debugEnabled: string | undefined;
}

interface State {
	totalStoryPoints: number;
	selectedTabId: string;
	iterationWorkItemRevisions: IHubWorkItemIterationRevisions[],
	changedWorkItems: ITypedWorkItem[],
	flattenedRelevantRevisions: ITypedWorkItem[],
	debugEnabled: string | undefined;
}

export class IterationHistoryDisplay extends React.Component<IterationHistoryDisplayProps, State> {
	chartOptions = {
		responsive: true,
		scales: {
			y: {
				suggestedMin: 0
			}
		}
	};
	completeChartData: ChartData<"line", (number | Point | null)[], unknown> = { datasets: [] };
	dailyChartData: ChartData<"line", (number | Point | null)[], unknown> = { datasets: [] };
	dailyCompleteChartData: ChartData<"line", (number | Point | null)[], unknown> = { datasets: [] };

	constructor(props: IterationHistoryDisplayProps) {
		super(props);
		this.state = {
			totalStoryPoints: 0,
			selectedTabId: 'daily',
			iterationWorkItemRevisions: [],
			changedWorkItems: [],
			flattenedRelevantRevisions: [],
			debugEnabled: props.debugEnabled,
		};
	}

	public render(): JSX.Element | null {
		const selectedIterationPath = this.props.iteration ? this.props.iteration.path : undefined;
		const { selectedTabId } = this.state;

		if (!this.props.workItemHistory?.length) {
			if (this.props.doneLoading) {
				return null;
			} else {
				return (<div className="loader-container"><div className="loader"></div><div>Loading Data</div></div>);
			}
		}

		if (this.props.debugEnabled === 'debug') {
			console.log(this.props.iteration?.attributes.startDate);
			console.log(this.props.iteration?.attributes.startDate.toLocaleDateString(undefined, { timeZone: 'UTC' }));
			console.log(this.props.iteration?.attributes.finishDate);
			console.log(this.props.iteration?.attributes.finishDate.toLocaleDateString(undefined, { timeZone: 'UTC' }));
		}

		const iterationWorkItemRevisions: IHubWorkItemIterationRevisions[] = this.props.workItemHistory.map(wiHistory => {
			const typedWorkItems: ITypedWorkItem[] = wiHistory.revisions.map(workItem => getTypedWorkItem(workItem));

			const firstRevision = selectedIterationPath ? typedWorkItems.find(wi => wi.iterationPath === selectedIterationPath) : undefined;

			return {
				id: wiHistory.id,
				iterationPath: selectedIterationPath,
				firstRevision: firstRevision,
				relevantRevisions: selectedIterationPath ? getIterationRelevantWorkItems(typedWorkItems, selectedIterationPath) : []
			};
		});

		function getChangedWorkItems(workItems: ITypedWorkItem[]): ITypedWorkItem[] {
			return workItems
				.filter((wi, i, array) => {
					if (i === 0) {
						return true;
					}
					const previousItem = array[i-1];
					if (wi.id !== previousItem.id || isWorkItemClosed(wi) !== isWorkItemClosed(previousItem) || (wi.storyPoints !== previousItem.storyPoints && !isWorkItemClosed(wi)) || ((wi.state === 'Removed' || previousItem.state === 'Removed') && (wi.state !== 'Removed' || previousItem.state !== 'Removed')) || wi.iterationPath !== previousItem.iterationPath) {
						return true;
					}
					return false;
				})
				.sort((a, b) => a.changedDateFull === b.changedDateFull ? 0 : a.changedDateFull > b.changedDateFull ? 1 : -1);
		}

		function getWorkItemChange(workItem: ITypedWorkItem, currentIndex: number, allWorkItems: ITypedWorkItem[]): ITypedWorkItemWithRevision {
			const previousWorkItemRevisions = allWorkItems
				.slice(0, currentIndex)
				.filter(wi => wi.id === workItem.id)
				.sort((a, b) => a.revision === b.revision ? 0 : a.revision < b.revision ? 1 : -1);

			const returnData: ITypedWorkItemWithRevision = {
				workItem: workItem,
				lastRevision: undefined,
				change: []
			};

			if (previousWorkItemRevisions.length === 0) {
				returnData.change.push('Added');
				return returnData;
			}
			const lastRevision = previousWorkItemRevisions[0];
			returnData.lastRevision = previousWorkItemRevisions[0];

			if (lastRevision.iterationPath !== workItem.iterationPath) {
				returnData.change.push(workItem.iterationPath === selectedIterationPath ? 'Added' : 'Removed');
			} else {
				if (lastRevision.state === 'Removed' && workItem.state !== 'Removed') {
					returnData.change.push('Reopened');
				} else if (lastRevision.state !== 'Removed' && workItem.state === 'Removed') {
					returnData.change.push('Removed');
				}
			}
			if (isWorkItemClosed(lastRevision) !== isWorkItemClosed(workItem)) {
				if (isWorkItemClosed(workItem)) {
					returnData.change.push('Closed');
				} else if (isWorkItemClosed(lastRevision)) {
					returnData.change.push('Reopened');
				}
			}
			if (lastRevision.storyPoints !== workItem.storyPoints) {
				returnData.change.push('Story Points Changed');
			}
			if (returnData.change.length === 0) {
				returnData.change.push('unknown');
			}
			return returnData;
		}

		function isWorkItemClosed(workItem: ITypedWorkItem): boolean {
			return workItem.state === 'Closed';
		}

		let totalStoryPoints = 0;

		const flattenedRelevantRevisions = getFlattenedRelevantRevisions(iterationWorkItemRevisions);
		const changedWorkItems = getChangedWorkItems(flattenedRelevantRevisions);
		// The following is for debugging purposes only.
		// TODO add this to the display as a debug toggle perhaps?
		/*if (this.state.iterationWorkItemRevisions.length === 0) {
			this.setState({
				iterationWorkItemRevisions: iterationWorkItemRevisions,
				flattenedRelevantRevisions: flattenedRelevantRevisions,
				changedWorkItems: changedWorkItems,
			});
			console.log(this.state);
		}*/

		const storyPointChanges: ITypedWorkItemChangeData[] = changedWorkItems.map((wi, i, a) => {
			const workItemChange = getWorkItemChange(wi, i, a);
			const storyClosed = isWorkItemClosed(wi);
			const storyPointsChanged = workItemChange.change.indexOf('Story Points Changed') >= 0;
			const storyRemoved = workItemChange.change.indexOf('Removed') >= 0;
			let addedStoryPoints = 0;
			let subtractedStoryPoints = 0;
			let showAddedPoints = false;
			let showSubtractedPoints = false;
			if (storyClosed) {
				subtractedStoryPoints = wi.storyPoints;
				showSubtractedPoints = true;
			}
			if (workItemChange.change.indexOf('Added') >= 0) {
				addedStoryPoints = wi.storyPoints;
				showAddedPoints = true;
			}
			if (workItemChange.change.indexOf('Reopened') >= 0) {
				addedStoryPoints = wi.storyPoints;
				showAddedPoints = true;
			}
			if (storyRemoved) {
				subtractedStoryPoints = wi.storyPoints;
				showSubtractedPoints = true;
				if (storyClosed && workItemChange.lastRevision && isWorkItemClosed(workItemChange.lastRevision)) {
					// If the story was already closed, no need to remove points.
					subtractedStoryPoints = 0;
				} else if (storyPointsChanged) {
					addedStoryPoints = wi.storyPoints;
					showAddedPoints = true;
					subtractedStoryPoints += workItemChange.lastRevision?.storyPoints ?? 0;
				}
			}
			if (storyPointsChanged) {
				if (!showAddedPoints && !showSubtractedPoints) {
					addedStoryPoints = wi.storyPoints;
					subtractedStoryPoints = workItemChange.lastRevision?.storyPoints ?? 0;
					showAddedPoints = true;
					showSubtractedPoints = true;
				} else if (storyClosed) {
					addedStoryPoints = wi.storyPoints;
					subtractedStoryPoints += workItemChange.lastRevision?.storyPoints ?? 0;
					showAddedPoints = true;
					showSubtractedPoints = true;
				}
			}

			let changeCharacterCode = 160;
			if (addedStoryPoints > subtractedStoryPoints) {
				changeCharacterCode = 8593; //8599;
			} else if (addedStoryPoints < subtractedStoryPoints) {
				changeCharacterCode = 8595; //8600
			}

			const updatedTotalStoryPoints = addedStoryPoints - subtractedStoryPoints;
			totalStoryPoints += updatedTotalStoryPoints;

			const totalStoryPointsClass = 'story-points total' + (updatedTotalStoryPoints > 0 ? ' increase' : updatedTotalStoryPoints < 0 ? ' decrease' : '');

			return {
				id: wi.id,
				title: wi.title,
				url: wi.url,
				addedStoryPoints: addedStoryPoints,
				showAddedPoints: showAddedPoints,
				subtractedStoryPoints: subtractedStoryPoints,
				showSubtractedPoints: showSubtractedPoints,
				totalStoryPointsClass: totalStoryPointsClass,
				totalStoryPoints: totalStoryPoints,
				changedDate: wi.changedDate,
				changedDateFull: wi.changedDateFull,
				workItemChange: workItemChange,
				changeCharacterCode: changeCharacterCode,
				state: wi.state,
				type: wi.type,
			};
		});

		this.completeChartData = {
			labels: storyPointChanges.map((cwi, index, changes) => {
				if (index === 0 || cwi.changedDateFull.toLocaleDateString() !== changes[index - 1].changedDateFull.toLocaleDateString()) {
					return cwi.changedDateFull.toLocaleString();
				}
				return cwi.changedDateFull.toLocaleTimeString();
			}),
			datasets: [
				{
					label: 'Story Points',
					data: storyPointChanges.map(cwi => cwi.totalStoryPoints),
					borderColor: 'rgb(53, 162, 235)',
					backgroundColor: 'rgba(53, 162, 235, 0.5)'
				}
			]
		};

		if (this.props.debugEnabled === 'debug') {
			console.log(storyPointChanges.map((spc) => {
				return { changedDate: spc.changedDate, changedDateFull: spc.changedDateFull, id: spc.id };
			}));
		}
		const changedStoriesByDate = this.groupStoryPointChangesByDate(storyPointChanges);
		const changedStoriesDates = [...changedStoriesByDate.keys()];
		if (this.props.debugEnabled === 'debug') {
			console.log(changedStoriesDates);
		}

		const completeHistoryDates: string[] = changedStoriesDates.length > 0 ? this.getDateRangeFromDates(
			changedStoriesDates[0],
			changedStoriesDates[changedStoriesDates.length - 1]
		) : [];
		if (this.props.debugEnabled === 'debug') {
			console.log(changedStoriesDates);
			console.log(completeHistoryDates);
		}
		const completeHistoryDatesData = this.getIterationDatesLastStoryPoints(completeHistoryDates, changedStoriesByDate);
		this.dailyCompleteChartData = {
			labels: completeHistoryDates,
			datasets: [
				{
					label: 'Story Points',
					data: completeHistoryDatesData,
					borderColor: 'rgb(53, 162, 235)',
					backgroundColor: 'rgba(53, 162, 235, 0.5)'
				}
			]
		};

		const iterationDates = this.props.iteration ? this.getDateRange(
			this.props.iteration.attributes.startDate.toLocaleDateString(undefined, { timeZone: 'UTC' }),
			this.props.iteration.attributes.finishDate.toLocaleDateString(undefined, { timeZone: 'UTC' })
		) : [];
		const iterationDatesData = this.getIterationDatesLastStoryPoints(iterationDates, changedStoriesByDate);
		if (this.props.debugEnabled === 'debug') {
			console.log(iterationDates);
		}

		this.dailyChartData = {
			labels: iterationDates,
			datasets: [
				{
					label: 'Story Points',
					data: iterationDatesData,
					borderColor: 'rgb(53, 162, 235)',
					backgroundColor: 'rgba(53, 162, 235, 0.5)'
				}
			]
		};

		if (!this.props.iteration) {
			return null;
		}

		const iterationStartDate = this.props.iteration!.attributes.startDate;
		const iterationFinishDate = this.props.iteration!.attributes.finishDate;
		let addedIterationStartRow = false;
		let addedIterationEndRow = false;
		let addIterationStartRow = false;
		let addIterationEndRowBefore = false;
		let addIterationEndRowAfter = false;
		const preIterationChanges = { changes: 0, storyPoints: 0 };
		const postIterationChanges = { changes: 0, storyPoints: 0 };
		const canDisplayEndSprintRow = this.props.iteration && (new Date()).toISOString() > iterationFinishDate.toISOString();

		return (
			<Card className="iteration-history-display"
				titleProps={{ text: "Sprint History", ariaLevel: 3 }}>
				<div className="display-child tab-charts">
					<TabBar
						onSelectedTabChanged={this.onSelectedTabChanged}
						selectedTabId={selectedTabId}>
						<Tab name="Daily During Sprint" id="daily" />
						<Tab name="Daily Complete History" id="daily-complete" />
						<Tab name="Complete History" id="complete" />
					</TabBar>

					{ this.getTabContent() }
				</div>
				<table className="display-child">
					<thead>
						<tr>
							<th className="date">Date</th>
							<th>Work Item</th>
							<th>Change</th>
							<th className="story-points">Story Points<br />Added</th>
							<th className="story-points">Story Points<br />Removed</th>
							<th className="story-points">Remaining</th>
						</tr>
					</thead>
					<tbody>
						{this.state.selectedTabId === 'daily' && storyPointChanges.map((wi, i) => {
							if (addIterationStartRow && !addedIterationStartRow) {
								addIterationStartRow = false;
								addedIterationStartRow = true;
							}
							if (addIterationEndRowBefore && !addedIterationEndRow) {
								addIterationEndRowBefore = false;
								addedIterationEndRow = true;
							} else if (addIterationEndRowAfter && !addedIterationEndRow) {
								addIterationEndRowAfter = false;
								addedIterationEndRow = true;
							}

							if (!addedIterationStartRow && wi.changedDateFull.toISOString().split("T")[0] < iterationStartDate.toISOString().split("T")[0]) {
								preIterationChanges.changes++;
								preIterationChanges.storyPoints = wi.totalStoryPoints;
								return null;
							}

							if (!addedIterationStartRow && wi.changedDateFull.toISOString().split("T")[0] >= iterationStartDate.toISOString().split("T")[0]) {
								addIterationStartRow = true
							}
							if (!addedIterationEndRow && i === storyPointChanges.length - 1) {
								addIterationEndRowAfter = true;
								if (wi.changedDateFull.toISOString().split("T")[0] > iterationFinishDate.toISOString().split("T")[0]) {
									postIterationChanges.changes++;
									postIterationChanges.storyPoints = wi.totalStoryPoints;
									if (canDisplayEndSprintRow) {
										return (
											<tr key={i}><td>{iterationFinishDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}</td><td colSpan={4}><strong>Sprint Ended</strong><br />{postIterationChanges.changes !== 0 ? `${postIterationChanges.changes} post-sprint changes hidden from this view` : ''}</td><td className={wi.totalStoryPointsClass}></td></tr>
										);
									} else {
										return null;
									}
								}
							} else if (!addedIterationEndRow && wi.changedDateFull.toISOString().split("T")[0] > iterationFinishDate.toISOString().split("T")[0]) {
								postIterationChanges.changes++;
								postIterationChanges.storyPoints = wi.totalStoryPoints;
								return null;
							}

							if (addIterationStartRow && postIterationChanges.changes !== 0) {
								return (
									<tr key={i}><td>{iterationStartDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}</td><td colSpan={4}><strong>Sprint Started</strong><br />{preIterationChanges.changes !== 0 ? `${preIterationChanges.changes} pre-sprint changes hidden from this view` : ''}</td><td className={wi.totalStoryPointsClass}>{preIterationChanges.changes !== 0 ? preIterationChanges.storyPoints : ''} &nbsp;</td></tr>
								);
							}

							return (
								<React.Fragment key={i}>
									{
										addIterationStartRow && <tr><td>{iterationStartDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}</td><td colSpan={4}><strong>Sprint Started</strong><br />{preIterationChanges.changes !== 0 ? `${preIterationChanges.changes} pre-sprint changes hidden from this view` : ''}</td><td className={wi.totalStoryPointsClass}>{preIterationChanges.changes !== 0 ? preIterationChanges.storyPoints : ''} &nbsp;</td></tr>
									}
									<tr>
										<td>{wi.changedDateFull.toLocaleString()}</td>
										<td>
											<WorkItemTypeIconDisplay projectWorkItemTypes={this.props.projectWorkItemTypes} type={wi.type} />
											<a href={wi.url} target="_blank" rel="noreferrer" title={wi.title}>{wi.id}</a><br />
											{wi.title}
											<div className="current-state secondary-text font-size-ms">Current State: {wi.state}</div>
										</td>
										<td>{wi.workItemChange.change.join(', ')}</td>
										<td className="story-points increase">{wi.addedStoryPoints !== 0 || wi.showAddedPoints ? '+' + wi.addedStoryPoints : ''}</td>
										<td className="story-points decrease">{wi.subtractedStoryPoints !== 0 || wi.showSubtractedPoints ? '-' + wi.subtractedStoryPoints : ''}</td>
										<td className={wi.totalStoryPointsClass}>{wi.totalStoryPoints} {String.fromCharCode(wi.changeCharacterCode)}</td>
									</tr>
									{
										addIterationEndRowAfter && canDisplayEndSprintRow && <tr key={i}><td>{iterationFinishDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}</td><td colSpan={4}><strong>Sprint Ended</strong><br />{postIterationChanges.changes !== 0 ? `${postIterationChanges.changes} post-sprint changes hidden from this view` : ''}</td><td className={wi.totalStoryPointsClass}></td></tr>
									}
								</React.Fragment>
							);
						})
						}

						{(this.state.selectedTabId === 'complete' || this.state.selectedTabId === 'daily-complete') && storyPointChanges.map((wi, i) => {
							if (addIterationStartRow && !addedIterationStartRow) {
								addIterationStartRow = false;
								addedIterationStartRow = true;
							}
							if (addIterationEndRowBefore && !addedIterationEndRow) {
								addIterationEndRowBefore = false;
								addedIterationEndRow = true;
							} else if (addIterationEndRowAfter && !addedIterationEndRow) {
								addIterationEndRowAfter = false;
								addedIterationEndRow = true;
							}

							if (!addedIterationStartRow && wi.changedDateFull.toISOString().split("T")[0] >= iterationStartDate.toISOString().split("T")[0]) {
								addIterationStartRow = true
							}

							if (!addedIterationEndRow && wi.changedDateFull.toISOString().split("T")[0] > iterationFinishDate.toISOString().split("T")[0]) {
								addIterationEndRowBefore = true;
							} else if (!addedIterationEndRow && i === storyPointChanges.length - 1) {
								addIterationEndRowAfter = true;
							}

							return (
								<React.Fragment key={i}>
									{
										addIterationStartRow && <tr><td>{iterationStartDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}</td><td colSpan={5}><strong>Sprint Started</strong></td></tr>
									}
									{
										addIterationEndRowBefore && canDisplayEndSprintRow && <tr><td>{iterationFinishDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}</td><td colSpan={5}><strong>Sprint Ended</strong></td></tr>
									}
									<tr>
										<td>{wi.changedDateFull.toLocaleString()}</td>
										<td>
											<WorkItemTypeIconDisplay projectWorkItemTypes={this.props.projectWorkItemTypes} type={wi.type} />
											<a href={wi.url} target="_blank" rel="noreferrer" title={wi.title}>{wi.id}</a><br />
											{wi.title}
											<div className="current-state secondary-text font-size-ms">Current State: {wi.state}</div>
										</td>
										<td>{wi.workItemChange.change.join(', ')}</td>
										<td className="story-points increase">{wi.addedStoryPoints !== 0 || wi.showAddedPoints ? '+' + wi.addedStoryPoints : ''}</td>
										<td className="story-points decrease">{wi.subtractedStoryPoints !== 0 || wi.showSubtractedPoints ? '-' + wi.subtractedStoryPoints : ''}</td>
										<td className={wi.totalStoryPointsClass}>{wi.totalStoryPoints} {String.fromCharCode(wi.changeCharacterCode)}</td>
									</tr>
									{
										addIterationEndRowAfter && canDisplayEndSprintRow && <tr><td>{iterationFinishDate.toLocaleDateString(undefined, { timeZone: 'UTC' })}</td><td colSpan={5}><strong>Sprint Ended</strong></td></tr>
									}
								</React.Fragment>
							);
						})
						}
					</tbody>
				</table>
			</Card>
		);
	}

	private onSelectedTabChanged = (newTabId: string) => {
		this.setState({
			selectedTabId: newTabId
		});
	}

	private getTabContent() {
		const { selectedTabId } = this.state;
		if (selectedTabId === 'complete') {
			return <Line options={this.chartOptions} data={this.completeChartData} />;
		} else if (selectedTabId === 'daily-complete') {
			return <Line options={this.chartOptions} data={this.dailyCompleteChartData} />
		} else {
			return <Line options={this.chartOptions} data={this.dailyChartData} />;
		}
	}

	private getDateRange(startDate: string, endDate: string, steps = 1): string[] {
		const dateArray = [];
		const currentDate = new Date(startDate);
		const endDateOnly = new Date(endDate).toISOString().split("T")[0];

		while (currentDate.toISOString().split("T")[0] <= endDateOnly) {
			dateArray.push(new Date(currentDate).toLocaleDateString());
			currentDate.setUTCDate(currentDate.getUTCDate() + steps);
		}

		return dateArray;
	}

	private getDateRangeFromDates(startDate: Date, endDate: Date, steps = 1): string[] {
		const dateArray = [];
		const currentDate = new Date(startDate);
		const endDateOnly = new Date(endDate).toISOString().split("T")[0];

		while (currentDate.toISOString().split("T")[0] <= endDateOnly) {
			dateArray.push(new Date(currentDate).toLocaleDateString());
			currentDate.setUTCDate(currentDate.getUTCDate() + steps);
		}

		return dateArray;
	}

	private groupStoryPointChanges(list: ITypedWorkItemChangeData[]): Map<string, ITypedWorkItemChangeData[]> {
		const map = new Map();
		list.forEach((item) => {
			const key = item.changedDateFull.toLocaleDateString();
			const collection = map.get(key);
			if (!collection) {
				map.set(key, [item]);
			} else {
				collection.push(item);
			}
		});
		return map;
	}

	private groupStoryPointChangesByDate(list: ITypedWorkItemChangeData[]): Map<Date, ITypedWorkItemChangeData[]> {
		const map: Map<Date, ITypedWorkItemChangeData[]> = new Map();
		list.forEach((item) => {
			const key = item.changedDateFull;
			const existingKey = Array.from(map.keys()).find(k => k.toLocaleDateString() === item.changedDateFull.toLocaleDateString());
			const collection = map.get(existingKey || key);
			if (!collection) {
				map.set(key, [item]);
			} else {
				collection.push(item);
			}
		});
		return map;
	}

	private getIterationDatesLastStoryPoints(iterationDates: string[], iterationStoryPoints: Map<Date, ITypedWorkItemChangeData[]>): (number | null)[] {
		if (iterationDates.length === 0 || iterationStoryPoints.size === 0) {
			return [];
		}

		const currentDate = new Date().toLocaleDateString();
		const storyPoints: (number | null)[] = [];
		const groupedStoryPointsKeys = Array.from(iterationStoryPoints.keys());
		const groupedStoryPointsKeysLookup = groupedStoryPointsKeys.map(key => {
			return {
				mapKey: key,
				dateOnlyKey: key.toLocaleDateString()
			};
		});

		iterationDates.forEach((date, index) => {
			const originalDateKey = groupedStoryPointsKeysLookup.find(k => k.dateOnlyKey === date);
			const lastStoryPoints = originalDateKey ? iterationStoryPoints.get(originalDateKey.mapKey) : undefined;
			if (lastStoryPoints) {
				storyPoints.push(lastStoryPoints[lastStoryPoints.length - 1].totalStoryPoints);
			} else if (index === 0) {
				// Isn't a match, so check if there's a previous date to carryover points from.
				const length = iterationStoryPoints.size;
				const iterator = iterationStoryPoints.keys();
				let itemKey: Date | undefined = iterator.next().value;
				let points = 0;
				for (let i = 0; i < length; i++) {
					if (itemKey === undefined || new Date(iterationDates[0]) <= new Date(itemKey)) {
						break;
					}
					const dateStoryPoints = iterationStoryPoints.get(itemKey)!;
					points = dateStoryPoints[dateStoryPoints.length - 1].totalStoryPoints;
					itemKey = iterator.next().value;
				}
				storyPoints.push(points);
			} else if (new Date(currentDate) >= new Date(date)) {
				storyPoints.push(storyPoints[index - 1]);
			} else {
				storyPoints.push(null);
			}
		});

		return storyPoints;
	}

	private getDateStringFormat(date: Date, format: string): string {
		if (format === 'YYYYMMDD') {
			return [date.getFullYear(), ('0' + (date.getMonth() + 1)).slice(-2), ('0' + date.getDate()).slice(-2)].join('-');
		}
		// Same format for now.
		return [date.getFullYear(), ('0' + (date.getMonth() + 1)).slice(-2), ('0' + date.getDate()).slice(-2)].join('-');
	}
}
