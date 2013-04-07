/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

const ShellVersion = imports.misc.config.PACKAGE_VERSION.split(".");
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

    if ((ShellVersion[0]==3)&&(ShellVersion[1]<7)) {
        let panel_switch = buildSwitcher('disable-activities-hotspot', "Disable the Activities (top left) hotspot");
        frame.add(panel_switch);
    }

    let panel_switch = buildSwitcher('show-categories', "Clasify applications in categories");
    frame.add(panel_switch);

    let panel_switch = buildSwitcher('show-first', "Show main button first in top bar");
    frame.add(panel_switch);

    let panel_entry = buildArrayString('key-binding',"Hotkeys to show the menu");
    frame.add(panel_entry);
    
    let icon_size = buildSpinButton('icon-size',"Size for icons");
    frame.add(icon_size);

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

function buildSpinButton(key, labeltext) {
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });

    let label = new Gtk.Label({label: labeltext, xalign: 0 });
    let adjust = new Gtk.Adjustment({lower: 16, upper: 128, value: settings.get_boolean(key), step_increment: 16});
    let spin = new Gtk.SpinButton({digits: 0, adjustment: adjust});


    settings.bind(key,adjust,'value',3);

    hbox.pack_start(label, true, true, 0);
    hbox.add(spin);

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

function buildArrayString(key, labeltext) {

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
    let label = new Gtk.Label({label: labeltext, xalign: 0 });
    let button = new Gtk.Button({label: "Default"});
    let entry = new Gtk.Entry();

    entry._customRefreshData = function () {
        let data=settings.get_value(key);
        let entries=data.get_strv();
        let text='[';
        for(let i in entries) {
            if (i!=0) {
                text+=',';
            }
            text+='\''+entries[i]+'\'';
        }
        text+=']';
        entry.set_text(text);
    }

    entry._customChanged=entry.connect('focus-out-event', function(element,event) {
        let c_text=element.get_text();
        let len=c_text.length;
        if (len<4) {
            return;
        }
        if ((c_text[0]!='[')||(c_text[1]!='\'')||(c_text[len-2]!='\'')||(c_text[len-1]!=']')) {
            return;
        }
        c_text=c_text.substring(2,len-2);
        entries=c_text.split('\',\'');
        let tmp = GLib.Variant.new_strv(entries);
        settings.set_value(key,tmp);
    });
    entry._customDestroy=entry.connect('destroy', function(element,event) {
        element.disconnect(element._customDestroy);
        element.disconnect(element._customChanged);
    });

    button._customClicked=button.connect('clicked', function(element,event) {
        settings.reset(key);
        entry._customRefreshData();
    });
    button._customDestroy=button.connect('destroy', function(element,event) {
        element.disconnect(element._customDestroy);
        element.disconnect(element._customClicked);
    });

    entry._customRefreshData();
    
    hbox.pack_start(label,true,true,0);
    hbox.add(button);
    hbox.add(entry);

    return hbox;
}
