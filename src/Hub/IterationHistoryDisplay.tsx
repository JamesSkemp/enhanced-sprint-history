import * as React from "react";
import "./IterationHistoryDisplay.scss";

import { TeamSettingsIteration } from "azure-devops-extension-api/Work";
import { IHubWorkItemHistory, IHubWorkItemIterationRevisions, ITypedWorkItem, ITypedWorkItemWithRevision } from "./HubInterfaces";
import { getFlattenedRelevantRevisions, getIterationRelevantWorkItems, getTypedWorkItem } from "./HubUtils";

export interface IterationHistoryDisplayProps {
	iteration: TeamSettingsIteration | undefined;
	workItemHistory: IHubWorkItemHistory[];
}

interface State {
	totalStoryPoints: number;
}

export class IterationHistoryDisplay extends React.Component<IterationHistoryDisplayProps, State> {
	constructor(props: IterationHistoryDisplayProps) {
		super(props);
		this.state = {
			totalStoryPoints: 0
		};
	}

	public render(): JSX.Element {
		const selectedIterationPath = this.props.iteration ? this.props.iteration.path : undefined;

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
					if (wi.id !== previousItem.id || isWorkItemClosed(wi) !== isWorkItemClosed(previousItem) || (wi.storyPoints !== previousItem.storyPoints && !isWorkItemClosed(wi)) || wi.iterationPath !== previousItem.iterationPath) {
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

			let returnData: ITypedWorkItemWithRevision = {
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

		return (
			<div>
				<table>
					<thead>
						<tr>
							<th className="date">Date</th>
							<th>User Story</th>
							<th>Change</th>
							<th className="story-points">Story Points<br />Added</th>
							<th className="story-points">Story Points<br />Removed</th>
							<th className="story-points">Remaining</th>
						</tr>
					</thead>
					<tbody>
						{
							getChangedWorkItems(getFlattenedRelevantRevisions(iterationWorkItemRevisions)).map((wi, i, a) => {
								const workItemChange = getWorkItemChange(wi, i, a);
								const storyClosed = isWorkItemClosed(wi);
								const storyPointsChanged = workItemChange.change.indexOf('Story Points Changed') >= 0;
								let addedStoryPoints = 0;
								let subtractedStoryPoints = 0;
								let showAddedPoints = false;
								let showSubtractedPoints = false;
								if (workItemChange.change.indexOf('Removed') >= 0) {
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
								if (storyClosed) {
									subtractedStoryPoints = wi.storyPoints;
									showSubtractedPoints = true;
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
									} else {
										// TODO potentially?
										/*console.groupCollapsed(wi.id);
										console.table(wi);
										console.log(workItemChange);
										console.groupEnd();*/
									}
								}

								let changeCharacterCode = 160;
								if (addedStoryPoints > subtractedStoryPoints) {
									changeCharacterCode = 8593; //8599;
								} else if (addedStoryPoints < subtractedStoryPoints) {
									changeCharacterCode = 8595; //8600
								}

								let updatedTotalStoryPoints = addedStoryPoints - subtractedStoryPoints;
								totalStoryPoints += updatedTotalStoryPoints;

								const totalStoryPointsClass = 'story-points total' + (updatedTotalStoryPoints > 0 ? ' increase' : updatedTotalStoryPoints < 0 ? ' decrease' : '');

								return (
									<tr>
										<td>{wi.changedDateFull.toLocaleString()}</td>
										<td><a href={wi.url} target="_blank" title={wi.title}>{wi.id}</a><br />{wi.title}</td>
										<td>{workItemChange.change.join(', ')}</td>
										<td className="story-points increase">{addedStoryPoints !== 0 || showAddedPoints ? '+' + addedStoryPoints : ''}</td>
										<td className="story-points decrease">{subtractedStoryPoints !== 0 || showSubtractedPoints ? '-' + subtractedStoryPoints : ''}</td>
										<td className={totalStoryPointsClass}>{totalStoryPoints} {String.fromCharCode(changeCharacterCode)}</td>
									</tr>
								);
							})
						}
					</tbody>
				</table>
			</div>
		);
	}
}
