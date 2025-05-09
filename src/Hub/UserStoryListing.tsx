import * as React from "react";
import "./UserStoryListing.scss";

import { Card } from "azure-devops-ui/Card";
import { WorkItem, WorkItemType } from "azure-devops-extension-api/WorkItemTracking";
import { ITypedWorkItem } from "./HubInterfaces";
import { getTypedWorkItem } from "./HubUtils";
import { TeamSettingsIteration } from "azure-devops-extension-api/Work";
import { Tab, TabBar } from "azure-devops-ui/Tabs";
import { WorkItemTypeIconDisplay } from "./WorkItemTypeIconDisplay";

export interface UserStoryListingProps {
	iteration: TeamSettingsIteration | undefined;
	projectWorkItemTypes: WorkItemType[];
	workItems: WorkItem[];
	doneLoading: boolean;
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
			if (this.props.doneLoading) {
				return (<div><p>No items found.</p></div>);
			} else {
				return (<div className="loader-container"><div className="loader"></div><div>Loading Data</div></div>);
			}
		}

		return (
			<Card className="user-story-listing"
				titleProps={{ text: "Work Items", ariaLevel: 3 }}>
				<section className="user-stories">
					<TabBar
						onSelectedTabChanged={this.onSelectedTabChanged}
						selectedTabId={selectedTabId}>
						<Tab name="All Items" id="all" />
						<Tab name="Items Still in the Sprint" id="current" />
						<Tab name="Items Removed from the Sprint" id="past" />
						<Tab name="Items by Assignee" id="assignee" />
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
				<p>These items are currently in this iteration.</p>
				{this.workItemDisplay(UserStoryDisplayFilter.Current)}
			</React.Fragment>;
		} else if (selectedTabId === 'past') {
			return <React.Fragment>
				<p>These items were in this iteration but have been removed.</p>
				{this.workItemDisplay(UserStoryDisplayFilter.Past)}
			</React.Fragment>;
		} else if (selectedTabId === 'assignee') {
			return <React.Fragment>
				<p>These users were assigned items.</p>
				{this.assigneeWorkItemDisplay()}
			</React.Fragment>
		} else {
			return <React.Fragment>
				<p>These items are or have been in this iteration.</p>
				{this.workItemDisplay(UserStoryDisplayFilter.All)}
			</React.Fragment>;
		}
	}

	private assigneeWorkItemDisplay(): JSX.Element[] | JSX.Element {
		if (this.typedWorkItems.length === 0) {
			return <p>There are no matching items.</p>;
		}

		const map: Map<string, ITypedWorkItem[]> = new Map();
		this.typedWorkItems.forEach((wi) => {
			const collection = map.get(wi.assignedToId);
			if (!collection) {
				map.set(wi.assignedToId, [wi]);
			} else {
				collection.push(wi);
			}
		});

		const assigneeIds = [...map.keys()];
		const assignees = assigneeIds.map(assignee => {
			const workItems = map.get(assignee)!;
			const workItemsThisIteration = workItems.filter(wi => wi.iterationPath === this.props.iteration?.path);
			return {
				assigneeId: workItems[0].assignedToId,
				assigneeDisplayName: workItems[0].assignedToDisplayName,
				assigneeImageUrl: workItems[0].assignedToImageUrl,
				workItems: workItems,
				totalWorkItems: workItems.length,
				totalWorkItemsThisIteration: workItemsThisIteration.length,
				totalStoryPoints: workItems.map(wi => wi.storyPoints).reduce((a, b) => a + b, 0),
				totalStoryPointsThisIteration: workItemsThisIteration.map(wi => wi.storyPoints).reduce((a, b) => a + b, 0),
			};
		}).sort((a, b) => a.assigneeDisplayName.localeCompare(b.assigneeDisplayName));

		return assignees.map(assignee => {
			return (
				<div key={assignee.assigneeId ?? 'unassigned'} className="assignee-item">
					{assignee.assigneeImageUrl === undefined ? <span className="unassigned-image"></span> : <img src={assignee.assigneeImageUrl} alt="" />}
					<div>
						<span>{assignee.assigneeDisplayName}</span>
						<div>
							<p>Currently in this iteration: {assignee.totalWorkItemsThisIteration} work items for {assignee.totalStoryPointsThisIteration} story points.</p>
							<p>Ever in this iteration: {assignee.totalWorkItems} work items for {assignee.totalStoryPoints} story points.</p>
						</div>
					</div>
				</div>
			);
		});
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
			return <p>There are no matching items.</p>;
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
					<WorkItemTypeIconDisplay projectWorkItemTypes={this.props.projectWorkItemTypes} type={workItem.type} />
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
