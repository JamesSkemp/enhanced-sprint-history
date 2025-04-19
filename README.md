# Enhanced Sprint History
Enhanced Sprint History supports viewing changes to user stories, or optionally other supported work items, in an iteration over time.

It features:
1. Three charts showing the sprint state.
2. The history of work item changes on the sprint.
3. A listing of all items that are or were in the sprint.
4. The ability to add other work item types.
	- Additional work item types must have the built-in **Story Points** field.

- [Primary Source](https://git.ebacher-skemp.com/azure-devops/enhanced-sprint-history)
- [Azure DevOps Mirror](https://dev.azure.com/jamesrskemp/azure-devops-extensions/_git/enhanced-sprint-history)

## Install
Install from Visual Studio Marketplace: https://marketplace.visualstudio.com/items?itemName=JamesSkemp.enhanced-sprint-history

## Support
Issues and feature requests can be submitted via [GitHub issues](https://github.com/JamesSkemp/enhanced-sprint-history/issues).

## Build
`npm run build` automatically increments the version and creates a new *.vsix file in the root directory.

Publish to https://marketplace.visualstudio.com/manage/publishers

### Development Build
`npm run build:dev` and upload once as a new extension. Share with instances that should support the dev instance.

Run `npx webpack serve`, navigate to https://localhost:3000/dist/Hub/Hub.html and accept the SSL cert, to then load the dev extension and develop locally.

## Dependencies
- [Run icon CC BY 3.0](https://game-icons.net/1x1/lorc/run.html).
