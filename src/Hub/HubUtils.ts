import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";
import { IHubWorkItemHistory, IHubWorkItemIterationRevisions, ITypedWorkItem } from "./HubInterfaces";

export function getTypedWorkItem(workItem: WorkItem): ITypedWorkItem {
	return {
		id: workItem.id,
		title: workItem.fields['System.Title'],
		url: workItem.url.replace('/_apis/wit/workItems/', '/_workitems/edit/'),
		iterationPath: workItem.fields['System.IterationPath'] ?? '',
		storyPoints: +(workItem.fields['Microsoft.VSTS.Scheduling.StoryPoints'] ?? 0),
		changedDate: workItem.fields['System.ChangedDate']?.toLocaleDateString(),
		changedDateFull: workItem.fields['System.ChangedDate'],
		state: workItem.fields['System.State'],
		revision: workItem.rev,
	};
}

export function getIterationRelevantWorkItems(typedWorkItems: ITypedWorkItem[], iterationPath: string): ITypedWorkItem[] {
	const firstRevision = typedWorkItems.find(wi => wi.iterationPath === iterationPath);
	if (!firstRevision) {
		return [];
	}

	return typedWorkItems.filter(wi => wi.revision >= firstRevision.revision);
}

export function getFlattenedRelevantRevisions(workItemHistory: IHubWorkItemIterationRevisions[]): ITypedWorkItem[] {
	return workItemHistory.reduce((accumulator: ITypedWorkItem[], value) => accumulator.concat(value.relevantRevisions), []);
}
