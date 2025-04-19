import { WorkItem, WorkItemType } from "azure-devops-extension-api/WorkItemTracking";

export interface ITypedWorkItem {
	id: number;
	title: string;
	url: string;
	iterationPath: string;
	storyPoints: number;
	changedDate: string;
	changedDateFull: Date;
	state: string;
	revision: number;
	assignedToDisplayName: string;
	assignedToId: string;
	assignedToImageUrl: string;
	type: string;
}

export interface ITypedWorkItemWithRevision {
	workItem: ITypedWorkItem;
	lastRevision: ITypedWorkItem | undefined;
	change: string[];
}

export interface IHubWorkItemHistory {
	id: number;
	revisions: WorkItem[];
}

export interface IHubWorkItemIterationRevisions {
	id: number;
	iterationPath: string | undefined;
	firstRevision: ITypedWorkItem | undefined;
	relevantRevisions: ITypedWorkItem[];
}

export interface IEnhancedSprintHistorySettings {
	showAdditionalWorkItemTypes: boolean;
	additionalWorkItemTypes: WorkItemType[];
}
