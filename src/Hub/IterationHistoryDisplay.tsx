import * as React from "react";
import "./IterationHistoryDisplay.scss";

import { TeamSettingsIteration } from "azure-devops-extension-api/Work";
import { IHubWorkItemHistory, IHubWorkItemIterationRevisions, ITypedWorkItem, ITypedWorkItemWithRevision } from "./HubInterfaces";
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
}

interface State {
	totalStoryPoints: number;
	selectedTabId: string;
	iterationWorkItemRevisions: IHubWorkItemIterationRevisions[],
	changedWorkItems: ITypedWorkItem[],
	flattenedRelevantRevisions: ITypedWorkItem[],
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
		};
	}

	public render(): JSX.Element | null {
		const selectedIterationPath = this.props.iteration ? this.props.iteration.path : undefined;
		const { selectedTabId } = this.state;

		if (!this.props.workItemHistory?.length) {
			return null;
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

		const storyPointChanges = changedWorkItems.map((wi, i, a) => {
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
				changedDateFull: wi.changedDateFull,
				url: wi.url,
				title: wi.title,
				id: wi.id,
				workItemChange: workItemChange,
				addedStoryPoints: addedStoryPoints,
				showAddedPoints: showAddedPoints,
				subtractedStoryPoints: subtractedStoryPoints,
				showSubtractedPoints: showSubtractedPoints,
				totalStoryPointsClass: totalStoryPointsClass,
				totalStoryPoints: totalStoryPoints,
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

		const changedStoriesByDate = this.groupStoryPointChanges(storyPointChanges);
		const changedStoriesDates = [...changedStoriesByDate.keys()];
		const completeHistoryDates: string[] = changedStoriesDates.length > 0 ? this.getDateRange(
			changedStoriesDates[0],
			changedStoriesDates[changedStoriesDates.length - 1]
		) : [];
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
						{storyPointChanges.map((wi, i) => {
							return (
								<tr key={i}>
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

		while (currentDate <= new Date(endDate)) {
			dateArray.push(new Date(currentDate).toLocaleDateString());
			currentDate.setUTCDate(currentDate.getUTCDate() + steps);
		}

		return dateArray;
	}

	private groupStoryPointChanges(list: any[]): Map<string, any[]> {
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

	private getIterationDatesLastStoryPoints(iterationDates: string[], iterationStoryPoints: Map<string, any[]>): (number | null)[] {
		if (iterationDates.length === 0 || iterationStoryPoints.size === 0) {
			return [];
		}

		const currentDate = new Date().toLocaleDateString();
		const storyPoints: (number | null)[] = [];
		iterationDates.forEach((date, index) => {
			const lastStoryPoints = iterationStoryPoints.get(date);
			if (lastStoryPoints) {
				storyPoints.push(lastStoryPoints[lastStoryPoints.length - 1].totalStoryPoints);
			} else if (index === 0) {
				// Isn't a match, so check if there's a previous date to carryover points from.
				const length = iterationStoryPoints.size;
				const iterator = iterationStoryPoints.keys();
				let itemKey: string = iterator.next().value;
				let points = 0;
				for (let i = 0; i < length; i++) {
					if (new Date(iterationDates[0]) <= new Date(itemKey)) {
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
}
