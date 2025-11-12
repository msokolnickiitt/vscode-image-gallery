import * as vscode from 'vscode';
import * as utils from './utils';
import * as gallery from './gallery/gallery';
import * as viewer from './viewer/viewer';
import * as editor from './editor/editor';
import * as generator from './generator/generator';
import * as telemetry from './telemetry';

export function activate(context: vscode.ExtensionContext) {
	utils.readPackageJSON(context);

	telemetry.activate(context);
	gallery.activate(context);
	viewer.activate(context);
	editor.activate(context);
	generator.activate(context);
}

export function deactivate() {
	gallery.deactivate();
	viewer.deactivate();
	editor.deactivate();
	generator.deactivate();
	telemetry.deactivate();
}
