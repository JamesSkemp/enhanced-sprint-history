import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { TeamSettingsIteration } from "azure-devops-extension-api/Work";
import { IHubWorkItemHistory, IHubWorkItemIterationRevisions, ITypedWorkItem } from "./HubInterfaces";
import { getFlattenedRelevantRevisions, getIterationRelevantWorkItems, getTypedWorkItem } from "./HubUtils";

export interface IterationHistoryDisplayProps {
	iteration: TeamSettingsIteration | undefined;
	workItemHistory: IHubWorkItemHistory[];
}

interface State {}

export class IterationHistoryDisplay extends React.Component<IterationHistoryDisplayProps, State> {
	constructor(props: IterationHistoryDisplayProps) {
		super(props);
		this.state = {};
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

		if (asdf?.length > 0) {
			console.log(getFlattenedRelevantRevisions(asdf));
			asdf.forEach(element => {
				console.groupCollapsed(element.id);
				console.log(element.firstRevision);
				console.table(element.relevantRevisions);
				console.groupEnd();
			});
		}

		function getChangedWorkItems(workItems: ITypedWorkItem[]): ITypedWorkItem[] {
			return workItems
				.filter((wi, i, arr) => i === arr.findIndex((twi) => wi.iterationPath === twi.iterationPath && wi.state === twi.state && wi.storyPoints === twi.storyPoints && wi.id === twi.id))
				.sort((a, b) => a.changedDateFull === b.changedDateFull ? 0 : a.changedDateFull > b.changedDateFull ? 1 : -1);
		}

		return (
			<div>
				<div>TODO iteration</div>
				<pre>
					{JSON.stringify(this.props.iteration, null, 2)}
				</pre>
				<div>TODO filtered work items</div>
				<pre>
					{JSON.stringify(getChangedWorkItems(getFlattenedRelevantRevisions(asdf)), null, 2)}
				</pre>
			</div>
		);
	}
}