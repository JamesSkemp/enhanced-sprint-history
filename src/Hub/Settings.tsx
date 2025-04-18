import * as React from "react";
import "./Settings.scss";
import { Card } from "azure-devops-ui/Card";
import { Icon } from "azure-devops-ui/Icon";
import { Toggle } from "azure-devops-ui/Toggle";
import { ObservableArray, ObservableValue } from "azure-devops-ui/Core/Observable";
import { Button } from "azure-devops-ui/Button";
import { Dropdown } from "azure-devops-ui/Dropdown";
import { WorkItemType } from "azure-devops-extension-api/WorkItemTracking";
import { IListBoxItem } from "azure-devops-ui/ListBox";
import { DropdownMultiSelection } from "azure-devops-ui/Utilities/DropdownSelection";
import { Observer } from "azure-devops-ui/Observer";

export interface SettingsProps {
	projectWorkItemTypes: WorkItemType[];
}

interface State {
	showSettings: boolean;
	dropdownDisabled: boolean;
}

export class Settings extends React.Component<SettingsProps, State> {
	private selection = new DropdownMultiSelection();
	private includeAdditionalWits = new ObservableValue<boolean>(false);
	private additionalWits = new ObservableArray<WorkItemType>([]);
	private witOptions: IListBoxItem[] = [];

	constructor(props: SettingsProps) {
		super(props);
		this.state = {
			showSettings: false,
			dropdownDisabled: true, // TODO set based upon props/saved settings
		};
		this.updateWitOptions();
	}

	componentDidUpdate(): void {
		if (this.props.projectWorkItemTypes.length) {
			this.updateWitOptions();
		} else {
			this.witOptions = [];
		}
	}

	private updateWitOptions() {
		this.witOptions = [];
		this.props.projectWorkItemTypes
			.filter(t => t.fields.some(f => f.referenceName === 'Microsoft.VSTS.Scheduling.StoryPoints'))
			.sort((a, b) => a.name.localeCompare(b.name))
			.forEach(wit => {
			this.witOptions.push({ id: wit.referenceName, text: wit.name });
		});
	}

	private saveAndRefresh(): void {
		// TODO bubble up to parent to save
		console.log('saveAndRefresh');
		console.log(this.includeAdditionalWits.value);
		console.log(this.selection);
		console.log(this.selection.value);
		if (this.selection.value.length > 0) {
			const asdf  = this.selection.value.map((range) => {
				return this.witOptions.slice(range.beginIndex, range.endIndex + 1);
			})
			.reduce((a, b) => a.concat(b), []);
			console.log(asdf);

		}
	}

	private toggleSettingsDisplay = () => {
		const newDisplay = !this.state.showSettings;
		this.setState({
			showSettings: newDisplay
		});
	}

	public render(): JSX.Element | null {
		const settingsEditClassName = this.state.showSettings ? 'show' : 'hide';

		return (
			<Card className={settingsEditClassName + ' iteration-history-settings'}
				titleProps={{ text: "Settings", ariaLevel: 3 }}>
				<section>
					<Icon iconName="Edit" onClick={this.toggleSettingsDisplay} />
					<section className={settingsEditClassName}>
						<p>Would you like to include additional work item types?</p>
						<Toggle
							offText="Only Including User Stories"
							onText="Including Additional Work Item Types"
							checked={this.includeAdditionalWits}
							onChange={(_event, value) => {this.includeAdditionalWits.value = value; this.setState({ dropdownDisabled: !value });}}
						/>
						<p>Additional work items to include:<br />
						<em>Only work item types with a Story Points field are supported.</em></p>
						<div className="wit-dropdown">
							<Observer selection={this.selection}>
								{() => {
									return (
										<Dropdown
											disabled={this.state.dropdownDisabled}
											items={this.witOptions}
											selection={this.selection}
											placeholder="Select Work Item Types"
											showFilterBox={true}
										/>
									);
								}}
							</Observer>
						</div>
						<div className="save-button">
							<Button text="Save and Refresh" onClick={(_event) => { this.saveAndRefresh(); }} />
						</div>
					</section>
				</section>
			</Card>
		)
	}
}
