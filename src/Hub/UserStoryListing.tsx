import * as React from "react";
import "./UserStoryListing.scss";

import { Card } from "azure-devops-ui/Card";
import { ScrollableList, IListItemDetails, ListSelection, ListItem, IListRow } from "azure-devops-ui/List";
import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";
import { ITypedWorkItem } from "./HubInterfaces";
import { getTypedWorkItem } from "./HubUtils";

export interface UserStoryListingProps {
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
			<Card className="user-story-listing">
				<section className="user-stories">
					{workItemDisplay}
				</section>
			</Card>
		);
	}
}
