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
import { IEnhancedSprintHistorySettings } from "./HubInterfaces";

export interface SettingsProps {
	savedSettings: IEnhancedSprintHistorySettings;
	projectWorkItemTypes: WorkItemType[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	onSaveSettings: any;
}

interface State {
	showSettings: boolean;
	dropdownDisabled: boolean;
}

export class Settings extends React.Component<SettingsProps, State> {
	private selection = new DropdownMultiSelection();
	private includeAdditionalWits = new ObservableValue<boolean>(false);
	private showAdditionalSavedSetting = false;
	private additionalWitsSavedSetting: WorkItemType[] = [];
	private additionalWits = new ObservableArray<WorkItemType>([]);
	private witOptions: IListBoxItem[] = [];

	constructor(props: SettingsProps) {
		super(props);
		const disableDropdown = !props.savedSettings || !props.savedSettings.showAdditionalWorkItemTypes;
		this.state = {
			showSettings: false,
			dropdownDisabled: disableDropdown,
		};
		this.updateWitOptions();
	}

	componentDidUpdate(): void {
		if (this.props.projectWorkItemTypes.length && this.witOptions.length === 0) {
			this.updateWitOptions();
		}
		if (this.props.savedSettings) {
			if (this.props.savedSettings.additionalWorkItemTypes.length !== this.additionalWitsSavedSetting.length) {
				this.additionalWitsSavedSetting = this.props.savedSettings.additionalWorkItemTypes;
				if (this.witOptions.length > 0 && this.additionalWitsSavedSetting.length > 0) {
					for (let i = 0; i < this.witOptions.length; i++) {
						const witOption = this.witOptions[i];
						if (this.additionalWitsSavedSetting.some(s => s.referenceName === witOption.id)) {
							this.selection.select(i);
						}
					}
				}
			}
			if (this.props.savedSettings.showAdditionalWorkItemTypes !== this.showAdditionalSavedSetting) {
				this.showAdditionalSavedSetting = this.props.savedSettings.showAdditionalWorkItemTypes;
				if (this.includeAdditionalWits.value !== this.showAdditionalSavedSetting) {
					this.includeAdditionalWits.value = this.showAdditionalSavedSetting;
					if (this.state.dropdownDisabled !== !this.includeAdditionalWits.value) {
						this.setState({ dropdownDisabled: !this.includeAdditionalWits.value });
					}
				}
			}
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
		let aWits: WorkItemType[] = [];
		if (this.selection.value.length > 0) {
			const optionsSelected  = this.selection.value.map((range) => {
				return this.witOptions.slice(range.beginIndex, range.endIndex + 1);
			})
			.reduce((a, b) => a.concat(b), []);
			const selectedIds = optionsSelected.map(o => o.id);
			aWits = this.props.projectWorkItemTypes.filter(pwt => selectedIds.some(i => i === pwt.referenceName));
		}

		const settings: IEnhancedSprintHistorySettings = {
			showAdditionalWorkItemTypes: this.includeAdditionalWits.value,
			additionalWorkItemTypes: aWits,
		};

		this.props.onSaveSettings(settings);
	}

	private toggleSettingsDisplay = () => {
		const newDisplay = !this.state.showSettings;
		this.setState({
			showSettings: newDisplay
		});
	}

	private updateToggle = (_event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>, value: boolean): void => {
		this.includeAdditionalWits.value = value;
		this.setState({ dropdownDisabled: !value });
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
							onChange={this.updateToggle}
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
