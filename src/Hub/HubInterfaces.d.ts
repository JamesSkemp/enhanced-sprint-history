import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";

export interface ITypedWorkItem {
	id: number;
	title: any;
	url: string;
	iterationPath: any;
	storyPoints: number;
	changedDate: any;
	changedDateFull: any;
	state: any;
	revision: number;
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
