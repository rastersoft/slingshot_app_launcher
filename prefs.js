const Gtk = imports.gi.Gtk;

const SlingShot_App_Launcher = imports.misc.extensionUtils.getCurrentExtension();
const Lib = SlingShot_App_Launcher.imports.lib;

const SCHEMA = "org.gnome.shell.extensions.slingshot_app_launcher";

let settings;

function init() {
	settings = Lib.getSettings(SCHEMA);
}


function buildPrefsWidget() {
	let frame = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, border_width: 10, spacing: 10});
	
	let panel_switch = buildSwitcher("show-activities", "Put the Activities button inside Slingshot");
	frame.add(panel_switch);
	
	let panel_switch = buildSwitcher("disable-activities-hotspot", "Disable the Activities (top left) hotspot");
	frame.add(panel_switch);

	frame.show_all();
	
	return frame;
}

function buildSwitcher(key, labeltext, tooltip) {
	let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
	
    let label = new Gtk.Label({label: labeltext, xalign: 0 });

    let switcher = new Gtk.Switch({active: settings.get_boolean(key)});
    
    settings.bind(key,switcher,"active",3);
    
    hbox.pack_start(label, true, true, 0);
    hbox.add(switcher);
    
    return hbox;
}

