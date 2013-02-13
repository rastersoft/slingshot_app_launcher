/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const SlingShot_App_Launcher = ExtensionUtils.getCurrentExtension();
const Lib = SlingShot_App_Launcher.imports.lib;
const SCHEMA = 'org.gnome.shell.extensions.slingshot_app_launcher';

let settings;

function init() {
    settings = Lib.getSettings(SCHEMA);
}


function buildPrefsWidget() {
    let frame = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, border_width: 10, spacing: 10});
    
    let panel_switch = buildSwitcher('hide-activities', "Put the Activities button inside Slingshot");
    frame.add(panel_switch);
    
    let panel_switch = buildSwitcher('disable-activities-hotspot', "Disable the Activities (top left) hotspot");
    frame.add(panel_switch);
    
    let panel_switch = buildSwitcher('show-categories', "Clasify applications in categories");
    frame.add(panel_switch);
    
    let prueba = buildSelect('menu-button',"Style for the main button");
    frame.add(prueba);

    frame.show_all();
    
    return frame;
}

function buildSwitcher(key, labeltext) {
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
    
    let label = new Gtk.Label({label: labeltext, xalign: 0 });

    let switcher = new Gtk.Switch({active: settings.get_boolean(key)});
    
    settings.bind(key,switcher,'active',3);
    
    hbox.pack_start(label, true, true, 0);
    hbox.add(switcher);
    
    return hbox;
}

function buildSelect(key, labeltext) {
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
    
    let label = new Gtk.Label({label: labeltext, xalign: 0 });

    let selector = new Gtk.ComboBoxText();
    let data=settings.get_range(key);
    let lista=data.get_child_value(1).get_child_value(0).get_strv();
    for (let i in lista) {
        selector.append(null, lista[i]);
    }
    
    selector._customChanged=selector.connect('changed', function() {
        settings.set_enum(key, selector.get_active());
    });
    selector._customDestroy=selector.connect('destroy', function(element, event) {
        element.disconnect(element._customDestroy);
        element.disconnect(element._customChanged);
    });
    selector.set_active(settings.get_enum(key));
    
    hbox.pack_start(label, true, true, 0);
    hbox.add(selector);
  
    return hbox;
}
