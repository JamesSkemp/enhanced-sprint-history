import * as React from "react";
import "./Settings.scss";
import { Card } from "azure-devops-ui/Card";
import { Icon } from "azure-devops-ui/Icon";

export interface SettingsProps {
}

interface State {
	showSettings: boolean;
}

export class Settings extends React.Component<SettingsProps, State> {
	constructor(props: SettingsProps) {
		super(props);
		this.state = {
			showSettings: false,
		};
	}

	componentDidUpdate(): void {
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
						Test
					</section>
				</section>
			</Card>
		)
	}
}
