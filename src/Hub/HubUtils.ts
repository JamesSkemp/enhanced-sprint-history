import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";
import { IHubWorkItemIterationRevisions, ITypedWorkItem } from "./HubInterfaces";

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
		assignedToDisplayName: workItem.fields['System.AssignedTo'] ? workItem.fields['System.AssignedTo'].displayName : 'unassigned',
		assignedToId: workItem.fields['System.AssignedTo']?.id,
		assignedToImageUrl: workItem.fields['System.AssignedTo']?.imageUrl,
	};
}

export function getIterationRelevantWorkItems(typedWorkItems: ITypedWorkItem[], iterationPath: string): ITypedWorkItem[] {
	const firstRevision = typedWorkItems.find(wi => wi.iterationPath === iterationPath);
	if (!firstRevision) {
		return [];
	}

	let typedWorkItemsRelevantToIteration = typedWorkItems.filter(wi => wi.revision >= firstRevision.revision);
	if (typedWorkItemsRelevantToIteration.find(wi => wi.iterationPath !== iterationPath)) {
		// Wasn't in the iteration at least once after it was.
		const typedWorkItemLastTimeInIteration = typedWorkItemsRelevantToIteration.sort((a, b) => a.revision === b.revision ? 0 : a.revision < b.revision ? 1 : -1).find(wi => wi.iterationPath === iterationPath);
		if (typedWorkItemLastTimeInIteration) {
			const indexWhenLastInIteration = typedWorkItemsRelevantToIteration.indexOf(typedWorkItemLastTimeInIteration);
			if (indexWhenLastInIteration !== 0) {
				typedWorkItemsRelevantToIteration = typedWorkItemsRelevantToIteration.filter(wi => wi.revision <= typedWorkItemsRelevantToIteration[indexWhenLastInIteration - 1].revision);
			}
		}
	}

	return typedWorkItemsRelevantToIteration;
}

export function getFlattenedRelevantRevisions(workItemHistory: IHubWorkItemIterationRevisions[]): ITypedWorkItem[] {
	return workItemHistory.reduce((accumulator: ITypedWorkItem[], value) => accumulator.concat(value.relevantRevisions.sort((a, b) => a.revision - b.revision)), []);
}
