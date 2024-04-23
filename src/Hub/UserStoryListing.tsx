import * as React from "react";
import "./UserStoryListing.scss";

import { Card } from "azure-devops-ui/Card";
import { ScrollableList, IListItemDetails, ListSelection, ListItem, IListRow } from "azure-devops-ui/List";
import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { ITypedWorkItem } from "./HubInterfaces";
import { getTypedWorkItem } from "./HubUtils";

export interface UserStoryListingProps {
	workItems: WorkItem[];
}

export class UserStoryListing extends React.Component<UserStoryListingProps> {
	private typedWorkItems: ITypedWorkItem[] = [];
	private selection = new ListSelection(true);

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

		return (
			<Card className="user-story-listing">
				<div style={{ display: "flex", height: "300px" }}>
					<ScrollableList
						itemProvider={new ArrayItemProvider(this.typedWorkItems)}
						renderRow={this.renderRow}
						selection={this.selection}
						singleClickActivation={false}
						onActivate={this.itemActivated}
						width="100%"
					/>
				</div>
			</Card>
		);
	}

	private itemActivated(event: React.SyntheticEvent<HTMLElement, Event>, listRow: IListRow<ITypedWorkItem>): void {
		window.open(listRow.data.url);
	}

	private renderRow = (
		index: number,
		item: ITypedWorkItem,
		details: IListItemDetails<ITypedWorkItem>,
		key?: string
	): JSX.Element => {
		return (
			<ListItem key={key || "list-item" + index} index={index} details={details}>
				<div className="list-example-row flex-row h-scroll-hidden">
					<div
						style={{ marginLeft: "10px", padding: "10px 0px" }}
						className="flex-column h-scroll-hidden"
					>
						<span className="wrap-text">{item.id} : {item.title} ({item.storyPoints})</span>
						<span className="fontSizeMS font-size-ms secondary-text wrap-text">
							Current iteration: {item.iterationPath}<br />
							{item.state}
						</span>
					</div>
				</div>
			</ListItem>
		);
	};
}
