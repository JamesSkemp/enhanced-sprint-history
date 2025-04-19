import * as React from "react";
import "./WorkItemTypeIconDisplay.scss";
import { WorkItemType } from "azure-devops-extension-api/WorkItemTracking";

export interface WorkItemTypeIconDisplayProps {
	type: string;
	projectWorkItemTypes: WorkItemType[];
}

export function WorkItemTypeIconDisplay(props: WorkItemTypeIconDisplayProps): JSX.Element {
	if (props.projectWorkItemTypes.length > 0) {
		const foundItem = props.projectWorkItemTypes.find(p => p.name === props.type);
		if (foundItem) {
			return <img title={foundItem.name} src={foundItem.icon.url} className="wit-icon" />;
		}

	}
	return <span>{props.type}</span>;
}
