import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { TeamSettingsIteration } from "azure-devops-extension-api/Work";
import { ITypedWorkItem } from "./HubInterfaces";

export interface IterationHistoryDisplayProps {
	iteration: TeamSettingsIteration | undefined;
	workItems: ITypedWorkItem[];
}

interface State {}

export class IterationHistoryDisplay extends React.Component<IterationHistoryDisplayProps, State> {
	constructor(props: IterationHistoryDisplayProps) {
		super(props);
		this.state = {};
	}

	public render(): JSX.Element {
		return (
			<div>
				<div>TODO iteration</div>
				<pre>
					{JSON.stringify(this.props.iteration, null, 2)}
				</pre>
				<div>TODO work items</div>
				<pre>
					{JSON.stringify(this.props.workItems, null, 2)}
				</pre>
			</div>
		);
	}
}
