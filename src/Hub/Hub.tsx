import "azure-devops-ui/Core/override.css";
import "./Hub.scss";

import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";

import { showRootComponent } from "../Common";

import { Page } from "azure-devops-ui/Page";
import { Header } from "azure-devops-ui/Header";

interface IHubContentState {

}

class HubContent extends React.Component<{}, IHubContentState> {
	constructor(props: {}) {
		super(props);

		this.state = {};
	}

	public componentDidMount(): void {
		SDK.init();
		this.getCustomData();
	}

	public render(): JSX.Element {
		return (
			<Page>
				<Header title="Enhanced Sprint History" />
				TODO
			</Page>
		);
	}

	private async getCustomData() {
		await SDK.ready();

	}
}

showRootComponent(<HubContent />);
