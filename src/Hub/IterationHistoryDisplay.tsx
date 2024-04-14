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

		const asdf: IHubWorkItemIterationRevisions[] = this.props.workItemHistory.map(wiHistory => {
			const typedWorkItems: ITypedWorkItem[] = wiHistory.revisions.map(workItem => getTypedWorkItem(workItem));

			console.log(wiHistory);
			console.log(`Typed Work Items for ${wiHistory.id}:`);
			console.table(typedWorkItems);

			const firstRevision = selectedIterationPath ? typedWorkItems.find(wi => wi.iterationPath === selectedIterationPath) : undefined;

			return {
				id: wiHistory.id,
				iterationPath: selectedIterationPath,
				firstRevision: firstRevision,
				relevantRevisions: selectedIterationPath ? getIterationRelevantWorkItems(typedWorkItems, selectedIterationPath) : []
			};
		});

		function getChangedWorkItems(workItems: ITypedWorkItem[]): ITypedWorkItem[] {
			// TODO this isn't working as expected ... excluding revisions that it shouldn't be, needs to look at previous change to see if it should be added instead
			// TODO fixed?
			console.log('uh oh');
			console.table(workItems);
			return workItems
				.filter((wi, i, array) => {
					if (i === 0) {
						return true;
					}
					const previousItem = array[i-1];
					if (wi.id !== previousItem.id || isWorkItemClosed(wi) !== isWorkItemClosed(previousItem) || wi.storyPoints !== previousItem.storyPoints) {
						return true;
					}
					return false;
				})
				.sort((a, b) => a.changedDateFull === b.changedDateFull ? 0 : a.changedDateFull > b.changedDateFull ? 1 : -1);
			/*return workItems
				.filter((wi, i, arr) => i === arr.findIndex((twi) => wi.iterationPath === twi.iterationPath && isWorkItemClosed(wi) === isWorkItemClosed(twi) && wi.storyPoints === twi.storyPoints && wi.id === twi.id))
				.sort((a, b) => a.changedDateFull === b.changedDateFull ? 0 : a.changedDateFull > b.changedDateFull ? 1 : -1);*/
		}

		function getWorkItemChange(workItem: ITypedWorkItem, currentIndex: number, allWorkItems: ITypedWorkItem[]): ITypedWorkItemWithRevision {
			const previousWorkItemRevisions = allWorkItems
				.slice(0, currentIndex)
				.filter(wi => wi.id === workItem.id)
				.sort((a, b) => a.revision === b.revision ? 0 : a.revision < b.revision ? 1 : -1);

			let returnData: ITypedWorkItemWithRevision = {
				workItem: workItem,
				lastRevision: undefined,
				change: ''
			};

			if (previousWorkItemRevisions.length === 0) {
				returnData.change = 'Added';
				return returnData;
			}
			const lastRevision = previousWorkItemRevisions[0];
			returnData.lastRevision = previousWorkItemRevisions[0];

			if (lastRevision.iterationPath !== workItem.iterationPath) {
				returnData.change = workItem.iterationPath === selectedIterationPath ? 'Added' : 'Removed';
				return returnData;
			}
			if (isWorkItemClosed(lastRevision) !== isWorkItemClosed(workItem)) {
				if (isWorkItemClosed(workItem)) {
					returnData.change = 'Closed';
					return returnData;
				} else if (isWorkItemClosed(lastRevision)) {
					returnData.change = 'Reopened';
					return returnData;
				}
			}
			if (lastRevision.storyPoints !== workItem.storyPoints) {
				returnData.change = 'Story Points Changed';
				return returnData;
			}
			console.groupCollapsed(currentIndex);
			console.log(previousWorkItemRevisions);
			console.log(workItem);
			console.log(currentIndex);
			console.log(allWorkItems);
			console.groupEnd();
			returnData.change = 'unknown';
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
							getChangedWorkItems(getFlattenedRelevantRevisions(asdf)).map((wi, i, a) => {
								const workItemChange = getWorkItemChange(wi, i, a);
								const storyClosed = isWorkItemClosed(wi);
								let addedStoryPoints = 0;
								let subtractedStoryPoints = 0;
								if (workItemChange.change === 'Removed') {
									subtractedStoryPoints = wi.storyPoints;
								} else if (workItemChange.change === 'Added') {
									addedStoryPoints = wi.storyPoints;
								} else if (workItemChange.change === 'Story Points Changed') {
									addedStoryPoints = wi.storyPoints;
									subtractedStoryPoints = workItemChange.lastRevision?.storyPoints ?? 0;
								} else if (workItemChange.change === 'Reopened') {
									addedStoryPoints = wi.storyPoints;
								} else if (storyClosed) {
									subtractedStoryPoints = wi.storyPoints;
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
										<td>{workItemChange.change}</td>
										<td className="story-points increase">{addedStoryPoints !== 0 || workItemChange.change === 'Story Points Changed' ? addedStoryPoints : ''}</td>
										<td className="story-points decrease">{subtractedStoryPoints !== 0 || workItemChange.change === 'Story Points Changed' || storyClosed || workItemChange.change === 'Removed' ? subtractedStoryPoints : ''}</td>
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
