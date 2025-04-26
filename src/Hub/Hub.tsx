import "azure-devops-ui/Core/override.css";
import "./Hub.scss";

import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IExtensionDataService, IGlobalMessagesService, IHostNavigationService, IProjectInfo, IProjectPageService, getClient } from "azure-devops-extension-api";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";

import { showRootComponent } from "../Common";
import { IListBoxItem } from "azure-devops-ui/ListBox";
import { WorkItem, WorkItemReference, WorkItemTrackingRestClient, WorkItemType } from "azure-devops-extension-api/WorkItemTracking";
import { IterationWorkItems, TaskboardColumn, TaskboardWorkItemColumn, TeamSettingsIteration, WorkRestClient } from "azure-devops-extension-api/Work";
import { CoreRestClient, WebApiTeam } from "azure-devops-extension-api/Core";
import { Dropdown } from "azure-devops-ui/Dropdown";
import { ListSelection } from "azure-devops-ui/List";
import { IEnhancedSprintHistorySettings, IHubWorkItemHistory } from "./HubInterfaces";
import { IterationHistoryDisplay } from "./IterationHistoryDisplay";
import { UserStoryListing } from "./UserStoryListing";
import { Settings } from "./Settings";

interface IHubContentState {
	project: string;
	projectName: string;
	teams: WebApiTeam[];
	teamIterations: TeamSettingsIteration[];
	selectedTeam: string;
	selectedTeamName: string;
	selectedTeamIteration: TeamSettingsIteration | undefined;
	selectedTeamIterationId: string;
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
	workItemsHistory: IHubWorkItemHistory[];
	projectWorkItemTypes: WorkItemType[];
	settings: IEnhancedSprintHistorySettings;
	doneLoading: boolean;
}

class HubContent extends React.Component<{}, IHubContentState> {
	private project: IProjectInfo | undefined;
	private teams: WebApiTeam[] = [];
	private teamIterations: TeamSettingsIteration[] = [];

	private teamSelection = new ListSelection();
	private teamIterationSelection = new ListSelection();

	private workItems: WorkItem[] = [];

	private queryParamsTeam: string = '';
	private queryParamsTeamIteration: string = '';

	constructor(props: {}) {
		super(props);

		this.state = {
			project: '',
			projectName: '',
			teams: [],
			teamIterations: [],
			selectedTeam: '',
			selectedTeamName: '',
			selectedTeamIteration: undefined,
			selectedTeamIterationId: '',
			selectedTeamIterationName: '',
			taskboardWorkItemColumns: [],
			taskboardColumns: [],
			workItems: [],
			workItemTypes: [],
			workItemsHistory: [],
			projectWorkItemTypes: [],
			settings: { showAdditionalWorkItemTypes: false, additionalWorkItemTypes: [] },
			doneLoading: false,
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

		function sprintDatesHeading(selectedTeamIteration: TeamSettingsIteration | undefined): JSX.Element | null {
			if (selectedTeamIteration && (selectedTeamIteration.attributes.startDate || selectedTeamIteration.attributes.finishDate)) {
				return (
					<p className="iteration-dates">{selectedTeamIteration.attributes.startDate ? selectedTeamIteration.attributes.startDate.toLocaleDateString(undefined, { timeZone: 'UTC' }) : ''} - {selectedTeamIteration.attributes.finishDate ? selectedTeamIteration.attributes.finishDate.toLocaleDateString(undefined, { timeZone: 'UTC' }) : ''}</p>
				);
			} else {
				return null;
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

				{this.state.selectedTeamIterationName && <h2>Sprint History for {this.state.selectedTeamName} : {this.state.selectedTeamIterationName}</h2>}
				{sprintDatesHeading(this.state.selectedTeamIteration)}

				<IterationHistoryDisplay iteration={this.state.selectedTeamIteration} workItemHistory={this.state.workItemsHistory} projectWorkItemTypes={this.state.projectWorkItemTypes} doneLoading={this.state.doneLoading} />

				<UserStoryListing iteration={this.state.selectedTeamIteration} workItems={this.state.workItems} projectWorkItemTypes={this.state.projectWorkItemTypes} doneLoading={this.state.doneLoading} />

				<Settings onSaveSettings={this.saveSettings} projectWorkItemTypes={this.state.projectWorkItemTypes} savedSettings={this.state.settings} />
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
		this.setState({ project: this.project.id, projectName: this.project.name });

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

		await this.getProjectWorkItemTypes();

		const saveDataTeam = await this.getSavedData();

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
			const queryTeamIndex = this.teams.findIndex(t => t.id === this.queryParamsTeam);
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
		} else if (saveDataTeam) {
			const saveDataTeamIndex = this.teams.findIndex(t => t.id === saveDataTeam);
			if (saveDataTeamIndex >= 0) {
				this.teamSelection.select(saveDataTeamIndex);
				this.setState({
					selectedTeam: this.teams[saveDataTeamIndex].id
				});
				this.setState({
					selectedTeamName: this.teams[saveDataTeamIndex].name
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

		let iteration;
		let iterationId = "";
		let iterationName = "";
		if (this.teamIterations.length === 1) {
			this.teamIterationSelection.select(0);

			iteration = this.teamIterations[0];
			iterationId = this.teamIterations[0].id;
			iterationName = this.teamIterations[0].name;
		} else {
			let currentIteration: TeamSettingsIteration | undefined;
			if (this.queryParamsTeamIteration) {
				currentIteration = this.teamIterations.find(i => i.id === this.queryParamsTeamIteration);
			}
			if (!currentIteration) {
				currentIteration = this.teamIterations.find(i => i.attributes.timeFrame === 1);
			}

			if (currentIteration) {
				this.teamIterationSelection.select(this.teamIterations.indexOf(currentIteration));

				iteration = currentIteration;
				iterationId = currentIteration.id;
				iterationName = currentIteration.name;
			}
		}

		if (iterationId !== '') {
			this.setState({
				selectedTeamIteration: iteration
			});
			this.setState({
				selectedTeamIterationId: iterationId
			});
			this.setState({
				selectedTeamIterationName: iterationName
			});
			this.getTeamIterationData();
		}
	}

	private showToast = async (message: string): Promise<void> => {
		const globalMessagesSvc = await SDK.getService<IGlobalMessagesService>(CommonServiceIds.GlobalMessagesService);
		globalMessagesSvc.addToast({
			duration: 3000,
			message: message
		});
	}

	private handleSelectTeam = (_event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>): void => {
		this.setState({
			selectedTeam: item.id
		});
		this.setState({
			selectedTeamName: item.text ?? ''
		});
		this.setState({
			selectedTeamIteration: undefined
		});
		this.setState({
			selectedTeamIterationId: ''
		});
		this.setState({
			selectedTeamIterationName: ''
		});
		this.getTeamData();
		this.updateQueryParams();
		this.saveSelectedTeam();
	}

	private handleSelectTeamIteration = (_event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>): void => {
		this.setState({
			selectedTeamIteration: this.state.teamIterations.find(ti => ti.id === item.id)
		});
		this.setState({
			selectedTeamIterationId: item.id
		});
		this.setState({
			selectedTeamIterationName: item.text ?? ''
		});
		this.getTeamIterationData();
		this.updateQueryParams();
	}

	private async getProjectWorkItemTypes() {
		await SDK.ready();
		const workItemTrackingClient = getClient(WorkItemTrackingRestClient);
		const projectWorkItemTypes = await workItemTrackingClient.getWorkItemTypes(this.state.project);
		this.setState({ projectWorkItemTypes: projectWorkItemTypes });
	}

	private async getTeamIterationData() {
		await SDK.ready();

		const selectedIteration = this.state.teamIterations.find(i => i.id === this.state.selectedTeamIterationId);
		if (!selectedIteration) {
			this.showToast('There was an issue loading the selected iteration.');
			return;
		}
		const selectedIterationPath = selectedIteration.path;

		const workItemTrackingClient = getClient(WorkItemTrackingRestClient);
		const workItemTypesWithoutStoryPoints = this.state.projectWorkItemTypes.filter(a => !a.fields.some(f => f.referenceName === 'Microsoft.VSTS.Scheduling.StoryPoints'));

		let baseQuery = "Select [System.Id] From WorkItems Where EVER ([System.IterationPath] = '" + selectedIterationPath + "')";
		if (workItemTypesWithoutStoryPoints.length > 0) {
			workItemTypesWithoutStoryPoints.forEach(wit => {
				baseQuery += " AND ([System.WorkItemType] <> '" + wit.name + "')";
			});
		}

		if (this.state.settings) {
			if (this.state.settings.showAdditionalWorkItemTypes && this.state.settings.additionalWorkItemTypes.length > 0) {
				baseQuery += " AND (";
				for (let index = 0; index < this.state.settings.additionalWorkItemTypes.length; index++) {
					const wit = this.state.settings.additionalWorkItemTypes[index];
					if (index !== 0) {
						baseQuery += " OR ";
					}
					baseQuery += "([System.WorkItemType] = '" + wit.name + "')";
				}
				baseQuery += ")";
			} else {
				// Default to User Stories.
				baseQuery += " AND ([System.WorkItemType] = 'User Story')";
			}
		}

		const workItemsEverInIteration = await workItemTrackingClient
			.queryByWiql({ query: baseQuery });

		if (!workItemsEverInIteration) {
			this.showToast('There was an issue getting the work items for the selected iteration.');
			return;
		}

		this.getWorkItemData(workItemsEverInIteration.workItems);
	}

	private async getWorkItemData(workItems: WorkItemReference[]) {
		// Clear previous items.
		this.workItems = [];
		this.setState({ workItems: this.workItems });
		this.setState({ workItemsHistory: [] });

		if (!workItems.length) {
			this.showToast('No work items found for this iteration.');
			this.setState({ doneLoading: true });
			return;
		} else {
			this.setState({ doneLoading: false });
		}

		const witClient = getClient(WorkItemTrackingRestClient);
		// This endpoint only accepts/returns up to 200 results, so limit/chunk to that.
		const maxRequestIds = 200;
		if (workItems.length <= maxRequestIds) {
			this.workItems = await witClient.getWorkItems(workItems.map(wi => wi.id));
		} else {
			// Temporary holder of work items, so they can be added all at once.
			const workItemsHolder: WorkItem[] = [];
			// Break the full list of ids into smaller chunks, and make a request for each.
			const chunkedWorkItems = Array.from({ length: Math.ceil(workItems.length / maxRequestIds)}, (v, k) => workItems.slice(k * maxRequestIds, k * maxRequestIds + maxRequestIds));
			// Must use a for of loop since we've got an await inside.
			for (const chunk of chunkedWorkItems) {
				workItemsHolder.push(...await witClient.getWorkItems(chunk.map(wi => wi.id)));
			}
			this.workItems = workItemsHolder;
		}
		this.setState({ workItems: this.workItems });

		const workItemsHistory: IHubWorkItemHistory[] = [];

		for (let index = 0; index < this.workItems.length; index++) {
			const element = this.workItems[index];

			const workItemRevisions = await witClient.getRevisions(element.id);
			workItemsHistory.push({ id: element.id, revisions: workItemRevisions });
		}

		this.setState({ workItemsHistory: workItemsHistory });
	}

	private async getQueryParams() {
		const navService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
		const hash = await navService.getQueryParams();

		return { queryTeam: hash['selectedTeam'], queryTeamIteration: hash['selectedTeamIterationId'] };
	}

	private updateQueryParams = async () => {
		const navService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
		navService.setQueryParams({ selectedTeam: "" + this.state.selectedTeam, selectedTeamIterationId: this.state.selectedTeamIterationId });
		navService.setDocumentTitle("" + this.state.selectedTeamName + " : " + this.state.selectedTeamIterationName + " - Enhanced Sprint History");
	}

	private async getSavedData(): Promise<string> {
		await SDK.ready();
		const accessToken = await SDK.getAccessToken();
		const extDataService = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
		const dataManager = await extDataService.getExtensionDataManager(SDK.getExtensionContext().id, accessToken);

		await dataManager.getValue<string>("enhancedSprintHistory" + this.state.project, { scopeType: "Default" }).then((data) => {
			if (data) {
				const savedData: IEnhancedSprintHistorySettings = JSON.parse(data);
				if (savedData) {
					this.setState({ settings: savedData });
				}
			}
		}, () => {
			// It's fine if no saved data is found.
		});

		let savedData = "";
		await dataManager.getValue<string>("selectedTeam" + this.state.project, { scopeType: "User" }).then((data) => {
			savedData = data;
		}, () => {
			// It's fine if no saved data is found.
		});

		return savedData;
	}

	private async saveSelectedTeam(): Promise<void> {
		await SDK.ready();
		const accessToken = await SDK.getAccessToken();
		const extDataService = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
		const dataManager = await extDataService.getExtensionDataManager(SDK.getExtensionContext().id, accessToken);
		await dataManager.setValue("selectedTeam" + this.state.project, this.state.selectedTeam, {scopeType: "User"}).then(() => {
			// No need to return anything.
		});
	}

	// Must be an arrow function to access `this`.
	private saveSettings = (updatedSettings: IEnhancedSprintHistorySettings): void => {
		this.setState({ settings: updatedSettings });
		this.saveProjectSettings();
	}

	private async saveProjectSettings(): Promise<void> {
		await SDK.ready();
		const accessToken = await SDK.getAccessToken();
		const extDataService = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
		const dataManager = await extDataService.getExtensionDataManager(SDK.getExtensionContext().id, accessToken);
		await dataManager.setValue("enhancedSprintHistory" + this.state.project, JSON.stringify(this.state.settings), { scopeType: "Default" }).then(() => {
			// No need to return anything.
			this.showToast('Settings saved.');
			this.getTeamIterationData();
		});
	}
}

showRootComponent(<HubContent />);
