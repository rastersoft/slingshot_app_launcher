/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

/***************************************************
 *           SlingShot for Gnome Shell             *
 *                                                 *
 * A clone of SlingShot launcher from ElementaryOS *
 *                                                 *
 * Created by rastersoft, and distributed under    *
 * GPLv2 or later license.                         *
 *                                                 *
 * Code based on Applications Menu, from gcampax   *
 *                                                 *
 ***************************************************/

const ShellVersion = imports.misc.config.PACKAGE_VERSION.split(".");
const Clutter = imports.gi.Clutter;
const GMenu = imports.gi.GMenu;
const Lang = imports.lang;
const Pango = imports.gi.Pango;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ICON_SIZE = 64;
const ICONS_PER_PAGE = 12;

let main_container;
let class_container;
let icons_container;
let global_container;

let current_selection;
let pages_visible_in_menu;
let current_page_visible_in_menu;

const SlingShotItem = new Lang.Class({
    Name: 'SlingShot.SlingShotItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (global_container,app, params) {
        this.parent(params);

        this._app = app;
        this.addActor(global_container);
    }
});

const ApplicationsButton = new Lang.Class({
    Name: 'SlingShot.ApplicationsButton',
    Extends: PanelMenu.Button,

    _init: function() {
        main_container=null;
        class_container=null;
        global_container=null;
        this.icon_counter=0;
        pages_visible_in_menu=0;
        this.parent(0.0,'SlingShot');
        this.actor.add_style_class_name('panel-status-button');
        this._box = new St.BoxLayout({ style_class: 'panel-status-button-box' });
        this.actor.add_actor(this._box);
        
        let icon = new St.Icon({ gicon: null, style_class: 'system-status-icon' });
        this._box.add_actor(icon);
        icon.icon_name='start-here';

        let etiqueta = new St.Label({ text: _("Applications")});
        this._box.add_actor(etiqueta);

        this._appSys = Shell.AppSystem.get_default();
        this._installedChangedId = this._appSys.connect('installed-changed', Lang.bind(this, this._refresh));

        this._display();
    },

    destroy: function() {
        this._appSys.disconnect(this._installedChangedId);
        this.parent();
    },

    _refresh: function() {
        this._display();
    },

    _clearAll: function() {
        this.menu.removeAll();
    },

    _sortApps: function(param1, param2) {

        if (param1.get_name().toUpperCase()<param2.get_name().toUpperCase()) {
            return -1;
        } else {
            return 1;
        }

    },

    _loadCategory: function(container,dir, menu) {

        this.posx=0;
        this.posy=0;
        this.icon_counter=0;
        
        let app_list=[];
        this._loadCategory2(container,dir,menu,app_list);

        app_list.sort(this._sortApps);

        var counter=0;
        var minimum_counter=current_page_visible_in_menu*ICONS_PER_PAGE;
        var maximum_counter=(current_page_visible_in_menu+1)*ICONS_PER_PAGE;

        for (var item in app_list) {
            counter+=1;
            if ((counter>minimum_counter)&&(counter<=maximum_counter)) {
                let app=app_list[item];
                let icon = app.create_icon_texture(ICON_SIZE);
                let texto = new St.Label({text:app.get_name(), style_class: 'slingshot_table'});
                let container2=new St.BoxLayout({vertical: true, reactive: true});
                texto.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
                texto.clutter_text.line_wrap = true;
                    
                container2.add(icon, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
                container2.add(texto, {x_fill: false, y_fill: true,x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
                container2._app=app;
                container2._custom_event_id=container2.connect('button-release-event',Lang.bind(this,this._onAppClick));
                container2._custom_destroy_id=container2.connect('destroy',Lang.bind(this,this._onDestroyActor));

                container.add(container2, { row: this.posy, col: this.posx, x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.START});
                this.posx+=1;
                if (this.posx==4) {
                    this.posx=0;
                    this.posy+=1;
                }
            }
        }

        if (this.icon_counter>ICONS_PER_PAGE) {
            pages_visible_in_menu=0;
            var pages=new St.BoxLayout({vertical: false});
            for (var i=0;i<=(this.icon_counter/ICONS_PER_PAGE);i++) {
                let clase='';
                if (i==current_page_visible_in_menu) {
                    clase='active';
                }
                let texto=(i+1).toString();
                let page_label = new St.Label({text: texto,style_class:'popup-menu-item',pseudo_class:clase, reactive: true});

                page_label._page_assigned=i;
                page_label._custom_event_id=page_label.connect('button-release-event',Lang.bind(this,this._onPageClick));
                page_label._custom_destroy_id=page_label.connect('destroy',Lang.bind(this,this._onDestroyActor));
                pages.add(page_label, {y_align:St.Align.END});
                pages_visible_in_menu+=1;
            }
            global_container.add(pages, {row: 1, col: 0, x_fill: false, y_fill: false, y_expand: false, x_align: St.Align.MIDDLE, y_align: St.Align.END});
        } else {
            pages_visible_in_menu=1;
        }
    },

    // Recursively load a GMenuTreeDirectory
    // (taken from js/ui/appDisplay.js in core shell)

    _loadCategory2: function(container,dir, menu,app_list) {
        var iter = dir.iter();
        var nextType;

        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                let entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    let app = this._appSys.lookup_app_by_tree_entry(entry);
                    app_list[this.icon_counter]=app;
                    this.icon_counter+=1;
                }
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                this._loadCategory2(container,iter.get_directory(), menu,app_list);
            }
        }
    },

    _display : function() {
        main_container = new St.BoxLayout({vertical: false});
        class_container = new St.BoxLayout({vertical: true});
        global_container = new St.Table({style_class:'slingshot_apps', homogeneous: false, reactive: true});
        icons_container = new St.Table({ homogeneous: false});
        main_container.add(class_container);
        global_container.add(icons_container, {row: 0, col:0, x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        main_container.add(global_container);

        let tree = this._appSys.get_tree();
        let root = tree.get_root_directory();

        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let dir = iter.get_directory();
                let name=dir.get_name();
                if (current_selection=='') {
                    current_selection=name;
                    current_page_visible_in_menu=0;
                }
                let clase='';
                let activated=false;
                if (name==current_selection) {
                    clase="active";
                    activated=true;
                }
                let item = new St.Label({text: name, style_class:'popup-menu-item', pseudo_class: clase, reactive: true});

                item._group_name=name;
                item._custom_event_id=item.connect('button-release-event',Lang.bind(this,this._onCategoryClick));
                item._custom_destroy_id=item.connect('destroy',Lang.bind(this,this._onDestroyActor));
                class_container.add(item);
                if (activated) {
                    this._loadCategory(icons_container,dir,item.menu);
                }
            }
        }

        if (pages_visible_in_menu>1) {
            global_container._custom_event_id=global_container.connect('scroll-event', Lang.bind(this,this._onScrollWheel));
            global_container._custom_destroy_id=global_container.connect('destroy',Lang.bind(this,this._onDestroyActor));
        }

        let ppal = new SlingShotItem(main_container,'',{reactive:false});
        this.menu.removeAll();
        this.menu.addMenuItem(ppal);
    },

    _onScrollWheel : function(actor,event) {
        let direction = event.get_scroll_direction();
        if ((direction == Clutter.ScrollDirection.DOWN) && (current_page_visible_in_menu<(pages_visible_in_menu-1))) {
            current_page_visible_in_menu+=1;
            this._display();
        }
        if ((direction == Clutter.ScrollDirection.UP) && (current_page_visible_in_menu>0)) {
            current_page_visible_in_menu-=1;
            this._display();
        }
    },

    _onCategoryClick : function(actor,event) {
        current_selection=actor._group_name;
        current_page_visible_in_menu=0;
        this._display();
    },

    _onAppClick : function(actor,event) {
/*      This is a launcher, so we create a new window; if we want
        to go to the current window, we should use

        actor._app.activate_full(-1,event.get_time()); */

        actor._app.open_new_window(-1);
        this.menu.close();
    },

    _onPageClick : function(actor,event) {
        current_page_visible_in_menu=actor._page_assigned;
        this._display();
    },

    _onDestroyActor : function(actor,event) {
        actor.disconnect(actor._custom_event_id);
        actor.disconnect(actor._custom_destroy_id);
    }

});

let SlingShotButton;

function enable() {
    current_page_visible_in_menu=0;
    current_selection='';
    SlingShotButton = new ApplicationsButton();
    
    if (ShellVersion[1]>4) {
        Main.panel.addToStatusArea('slingshot-menu', SlingShotButton, 0, 'left');
    } else {
        Main.panel._leftBox.insert_child_at_index(SlingShotButton.actor,0);
        Main.panel._menus.addMenu(SlingShotButton.menu);
    }
}

function disable() {
    SlingShotButton.destroy();
}

function init() {
    // Nothing to do here
}

