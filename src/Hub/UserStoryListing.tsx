import * as React from "react";
import "./UserStoryListing.scss";

import { Card } from "azure-devops-ui/Card";
import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";
import { ITypedWorkItem } from "./HubInterfaces";
import { getTypedWorkItem } from "./HubUtils";
import { TeamSettingsIteration } from "azure-devops-extension-api/Work";

export interface UserStoryListingProps {
	iteration: TeamSettingsIteration | undefined;
	workItems: WorkItem[];
}

export class UserStoryListing extends React.Component<UserStoryListingProps> {
	private typedWorkItems: ITypedWorkItem[] = [];

	constructor(props: UserStoryListingProps) {
		super(props);
	}

	componentDidUpdate(): void {
		if (this.props.workItems.length) {
			this.typedWorkItems = this.props.workItems.map(workItem => getTypedWorkItem(workItem));
		} else {
			this.typedWorkItems = [];
		}
	}

	public render(): JSX.Element | null {
		if (!this.typedWorkItems?.length) {
			return null;
		}

		const workItemDisplay = this.typedWorkItems.map(workItem => {
			return (
				<div>
					<a href={workItem.url} target="_blank">{workItem.id}</a> : {workItem.title} ({workItem.storyPoints})
					<div className="current-iteration secondary-text font-size-ms">Current Iteration: {workItem.iterationPath}</div>
					<div className="current-state secondary-text font-size-ms">{workItem.state}</div>
				</div>
			)
		});

		return (
			<Card className="user-story-listing"
				titleProps={{ text: "User Stories", ariaLevel: 3 }}>
				<section className="user-stories">
					<p>These stories are or have been in this iteration.</p>
					{workItemDisplay}
				</section>
			</Card>
		);
	}
}
