import "azure-devops-ui/Core/override.css";
import "./Hub.scss";

import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IGlobalMessagesService, IHostNavigationService, IProjectInfo, IProjectPageService, getClient } from "azure-devops-extension-api";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";

import { showRootComponent } from "../Common";
import { IListBoxItem } from "azure-devops-ui/ListBox";
import { WorkItem, WorkItemType } from "azure-devops-extension-api/WorkItemTracking";
import { IterationWorkItems, TaskboardColumn, TaskboardColumns, TaskboardWorkItemColumn, TeamSettingsIteration, WorkRestClient } from "azure-devops-extension-api/Work";
import { CoreRestClient, WebApiTeam } from "azure-devops-extension-api/Core";
import { Dropdown } from "azure-devops-ui/Dropdown";
import { ListSelection } from "azure-devops-ui/List";

interface IHubContentState {
	project: string;
	teams: WebApiTeam[];
	teamIterations: TeamSettingsIteration[];
	selectedTeam: string;
	selectedTeamName: string;
	selectedTeamIteration: string;
	selectedTeamIterationName: string;
	iterationWorkItems?: IterationWorkItems;
	taskboardWorkItemColumns: TaskboardWorkItemColumn[];
	/**
	 * All columns used in project team taskboards.
	 */
	taskboardColumns: TaskboardColumn[];
	workItems: WorkItem[];
	/**
	 * All work item types, such as Feature, Epic, Bug, Task, User Story.
	 */
	workItemTypes: WorkItemType[];
}

class HubContent extends React.Component<{}, IHubContentState> {
	private project: IProjectInfo | undefined;
	private teams: WebApiTeam[] = [];
	private teamIterations: TeamSettingsIteration[] = [];

	private teamSelection = new ListSelection();
	private teamIterationSelection = new ListSelection();

	private queryParamsTeam: string = '';
	private queryParamsTeamIteration: string = '';

	constructor(props: {}) {
		super(props);

		this.state = {
			project: '',
			teams: [],
			teamIterations: [],
			selectedTeam: '',
			selectedTeamName: '',
			selectedTeamIteration: '',
			selectedTeamIterationName: '',
			taskboardWorkItemColumns: [],
			taskboardColumns: [],
			workItems: [],
			workItemTypes: []
		};
	}

	public componentDidMount(): void {
		SDK.init();
		this.getCustomData();
	}

	public render(): JSX.Element {
		const {
			teams, teamIterations
		} = this.state;

		function teamDropdownItems(): Array<IListBoxItem<{}>> {
			if (teams) {
				return teams.map<IListBoxItem<{}>>(team => ({
					id: team.id, text: team.name
				}));
			} else {
				return [];
			}
		}

		function teamIterationDropdownItems(): Array<IListBoxItem<{}>> {
			if (teamIterations) {
				return teamIterations.map<IListBoxItem<{}>>(teamIteration => ({
					id: teamIteration.id, text: teamIteration.name
				}));
			} else {
				return [];
			}
		}

		return (
			<Page className="enhanced-sprint-history flex-grow">
				<Header title="Enhanced Sprint History"
					titleSize={TitleSize.Large} />

				<p>Select a Team</p>
				<Dropdown
					ariaLabel="Select a team"
					className="example-dropdown"
					placeholder="Select a Team"
					items={teamDropdownItems()}
					selection={this.teamSelection}
					onSelect={this.handleSelectTeam}
					dismissOnSelect={true}
				/>

				<p>Select an Iteration</p>
				<Dropdown
					ariaLabel="Select a team iteration"
					className="example-dropdown"
					placeholder="Select a Team Iteration"
					items={teamIterationDropdownItems()}
					selection={this.teamIterationSelection}
					onSelect={this.handleSelectTeamIteration}
					dismissOnSelect={true}
				/>

			</Page>
		);
	}

	private async getCustomData() {
		await SDK.ready();

		// Get the project.
		const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
		this.project = await projectService.getProject();

		if (!this.project) {
			this.showToast('No projects found.');
			return;
		}
		this.setState({ project: this.project.id });

		// Get teams.
		const coreClient = getClient(CoreRestClient);
		this.teams = await coreClient.getTeams(this.state.project);
		if (!this.teams) {
			this.showToast('No teams found.');
			return;
		}
		this.setState({ teams: this.teams });

		// Check the URL for a stored team and iteration.
		const queryParams = await this.getQueryParams();
		if (queryParams.queryTeam) {
			this.queryParamsTeam = queryParams.queryTeam;
			if (queryParams.queryTeamIteration) {
				this.queryParamsTeamIteration = queryParams.queryTeamIteration;
			}
		}

		if (this.teams.length === 1) {
			this.teamSelection.select(0);
			this.setState({
				selectedTeam: this.teams[0].id
			});
			this.setState({
				selectedTeamName: this.teams[0].name
			});
			this.getTeamData();
		} else if (this.queryParamsTeam) {
			// See if the team selection from the URL is a valid team.
			const queryTeamIndex = this.teams.findIndex(t => t.id == this.queryParamsTeam);
			if (queryTeamIndex >= 0) {
				// Select the team.
				this.teamSelection.select(queryTeamIndex);
				this.setState({
					selectedTeam: this.teams[queryTeamIndex].id
				});
				this.setState({
					selectedTeamName: this.teams[queryTeamIndex].name
				});
				this.getTeamData();
			}
		}
	}

	private async getTeamData() {
		await SDK.ready();
		const teamContext = { projectId: this.state.project, teamId: this.state.selectedTeam, project: "", team: "" };

		// Get team iterations.
		const workClient = getClient(WorkRestClient);
		this.teamIterations = await workClient.getTeamIterations(teamContext);
		if (!this.teamIterations) {
			this.showToast('No team iterations found.');
			return;
		}
		this.setState({ teamIterations: this.teamIterations });

		let iterationId = "";
		let iterationName = "";
		if (this.teamIterations.length === 1) {
			this.teamIterationSelection.select(0);

			iterationId = this.teamIterations[0].id;
			iterationName = this.teamIterations[0].name;
		} else {
			let currentIteration = this.teamIterations.find(i => i.attributes.timeFrame === 1);
			if (currentIteration) {
				this.teamIterationSelection.select(this.teamIterations.indexOf(currentIteration));

				iterationId = currentIteration.id;
				iterationName = currentIteration.name;
			}
		}

		if (iterationId !== '') {
			this.setState({
				selectedTeamIteration: iterationId
			});
			this.setState({
				selectedTeamIterationName: iterationName
			});
			// TODO
			//this.getTeamIterationData();
		}
	}

	private showToast = async (message: string): Promise<void> => {
		const globalMessagesSvc = await SDK.getService<IGlobalMessagesService>(CommonServiceIds.GlobalMessagesService);
		globalMessagesSvc.addToast({
			duration: 3000,
			message: message
		});
	}

	private handleSelectTeam = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>): void => {
		this.setState({
			selectedTeam: item.id
		});
		this.setState({
			selectedTeamName: item.text ?? ''
		});
		this.setState({
			selectedTeamIteration: ''
		});
		this.setState({
			selectedTeamIterationName: ''
		});
		this.getTeamData();
		this.updateQueryParams();
	}

	private handleSelectTeamIteration = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>): void => {
		this.setState({
			selectedTeamIteration: item.id
		});
		this.setState({
			selectedTeamIterationName: item.text ?? ''
		});
		// TODO
		//this.getTeamIterationData();
		this.updateQueryParams();
	}

	private async getQueryParams() {
		const navService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
		const hash = await navService.getQueryParams();

		return { queryTeam: hash['selectedTeam'], queryTeamIteration: hash['selectedTeamIteration'] };
	}

	private updateQueryParams = async () => {
		const navService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
		navService.setQueryParams({ selectedTeam: "" + this.state.selectedTeam, selectedTeamIteration: this.state.selectedTeamIteration });
		navService.setDocumentTitle("" + this.state.selectedTeamName + " : " + this.state.selectedTeamIterationName + " - Iteration Work Items");
	}
}

showRootComponent(<HubContent />);
