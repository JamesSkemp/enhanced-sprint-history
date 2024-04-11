import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";
import { ITypedWorkItem } from "./HubInterfaces";

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
	};
}
