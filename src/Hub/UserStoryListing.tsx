import * as React from "react";
import "./UserStoryListing.scss";

import { Card } from "azure-devops-ui/Card";
import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";
import { ITypedWorkItem } from "./HubInterfaces";
import { getTypedWorkItem } from "./HubUtils";
import { TeamSettingsIteration } from "azure-devops-extension-api/Work";
import { Tab, TabBar } from "azure-devops-ui/Tabs";

export interface UserStoryListingProps {
	iteration: TeamSettingsIteration | undefined;
	workItems: WorkItem[];
}

interface State {
	selectedTabId: string;
}

enum UserStoryDisplayFilter {
	All,
	Current,
	Past,
}

export class UserStoryListing extends React.Component<UserStoryListingProps, State> {
	private typedWorkItems: ITypedWorkItem[] = [];

	constructor(props: UserStoryListingProps) {
		super(props);
		this.state = {
			selectedTabId: 'all',
		};
	}

	componentDidUpdate(): void {
		if (this.props.workItems.length) {
			this.typedWorkItems = this.props.workItems.map(workItem => getTypedWorkItem(workItem));
		} else {
			this.typedWorkItems = [];
		}
	}

	public render(): JSX.Element | null {
		const { selectedTabId } = this.state;

		if (!this.typedWorkItems?.length) {
			return null;
		}

		return (
			<Card className="user-story-listing"
				titleProps={{ text: "User Stories", ariaLevel: 3 }}>
				<section className="user-stories">
					<TabBar
						onSelectedTabChanged={this.onSelectedTabChanged}
						selectedTabId={selectedTabId}>
						<Tab name="All Stories" id="all" />
						<Tab name="Stories Still in the Sprint" id="current" />
						<Tab name="Stories Removed from the Sprint" id="past" />
					</TabBar>

					<div className="tab-content">
						{ this.getTabContent() }
					</div>
				</section>
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
		if (selectedTabId === 'current') {
			return <React.Fragment>
				<p>These stories are currently in this iteration.</p>
				{this.workItemDisplay(UserStoryDisplayFilter.Current)}
			</React.Fragment>;
		} else if (selectedTabId === 'past') {
			return <React.Fragment>
				<p>These stories were in this iteration but have been removed.</p>
				{this.workItemDisplay(UserStoryDisplayFilter.Past)}
			</React.Fragment>;
		} else {
			return <React.Fragment>
				<p>These stories are or have been in this iteration.</p>
				{this.workItemDisplay(UserStoryDisplayFilter.All)}
			</React.Fragment>;
		}
	}

	private workItemDisplay(filter: UserStoryDisplayFilter): JSX.Element[] | JSX.Element {
		let filteredWorkItems: ITypedWorkItem[];
		switch (filter) {
			case UserStoryDisplayFilter.Current:
				filteredWorkItems = this.typedWorkItems.filter(wi => wi.iterationPath === this.props.iteration?.path);
				break;
			case UserStoryDisplayFilter.Past:
				filteredWorkItems = this.typedWorkItems.filter(wi => wi.iterationPath !== this.props.iteration?.path);
				break;
			case UserStoryDisplayFilter.All:
			default:
				filteredWorkItems = this.typedWorkItems;
				break;
		}

		if (filteredWorkItems.length === 0) {
			return <p>There are no matching user stories.</p>;
		}

		return filteredWorkItems.sort((a, b) => {
			if (a.iterationPath < b.iterationPath) {
				return -1;
			} else if (a.iterationPath > b.iterationPath) {
				return 1;
			}
			if (a.state < b.state) {
				return -1;
			} else if (a.state > b.state) {
				return 1;
			}
			return a.title.localeCompare(b.title);
		}).map(workItem => {
			return (
				<div key={workItem.id}>
					<a href={workItem.url} target="_blank" rel="noreferrer">{workItem.id}</a> : {workItem.title} ({workItem.storyPoints})
					<div className="current-iteration secondary-text font-size-ms">Current Iteration: {workItem.iterationPath}</div>
					<div className="current-state secondary-text font-size-ms">
					<div className={`state-circle item-state-${workItem.state.toLowerCase()}`}></div>
						{workItem.state}
					</div>
				</div>
			)
		});
	}
}
