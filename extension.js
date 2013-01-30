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

/* Versions:

    1: First public version
    2: Now highlights the icons when the mouse cursor flies over them
    3: Code much more compliant with Gnome Shell style
    4: Fixed three forgotten "this."
    5: Allows to move the Activities button inside the menu and
       disable the hotspot
    6: Packed the schemas (forgotten in version 5)
    
*/

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

const SlingShot_App_Launcher = imports.misc.extensionUtils.getCurrentExtension();
const Lib = SlingShot_App_Launcher.imports.lib;

const SCHEMA = "org.gnome.shell.extensions.slingshot_app_launcher";

const ICON_SIZE = 64;
const ICONS_PER_PAGE = 12;

let settings;

const SlingShotItem = new Lang.Class({
    Name: 'SlingShot.SlingShotItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (container,app, params) {
        this.parent(params);

        this._app = app;
        this.addActor(container);
    }
});

const ApplicationsButton = new Lang.Class({
    Name: 'SlingShot.ApplicationsButton',
    Extends: PanelMenu.Button,

    _init: function() {

        this.currentPageVisibleInMenu=0;
        this.currentSelection='';
        this.pagesVisibleInMenu=0;
        this.mainContainer=null;
        this.classContainer=null;
        this.globalContainer=null;
        this.iconsContainer=null;
        this.icon_counter=0;
        this._activitiesNoVisible=false;

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

        this._onSetActivitiesStatus();
        this._onSetActivitiesHotspot();
        this._settingBind=settings.connect("changed",Lang.bind(this,this._onChangedSetting));

        this._display();
    },

    destroy: function() {
        settings.disconnect(this._settingBind);
        this._setActivitiesNoVisible(false);
        this._setActivitiesNoHotspot(false);
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
        var minimumCounter=this.currentPageVisibleInMenu*ICONS_PER_PAGE;
        var maximumCounter=(this.currentPageVisibleInMenu+1)*ICONS_PER_PAGE;

							var shown_icons=0;
        for (var item in app_list) {
            counter+=1;
            if ((counter>minimumCounter)&&(counter<=maximumCounter)) {
            	    shown_icons+=1;
                let app=app_list[item];
                let icon = app.create_icon_texture(ICON_SIZE);
                let texto = new St.Label({text:app.get_name(), style_class: 'slingshot_table'});

														let container2=new St.BoxLayout({vertical: true, style_class:'slingshot_table_element'})                
                let container3=new St.BoxLayout({vertical: true, reactive: true, style_class:'popup-menu-item'});
                
                texto.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
                texto.clutter_text.line_wrap = true;
                //texto.clutter_text.line_ellipsize_mode = Pango.EllipsizeMode.END;

                container3.add(icon, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
                container3.add(texto, {x_fill: false, y_fill: true,x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
                container3._app=app;
                container3._customEventId=container3.connect('button-release-event',Lang.bind(this,this._onAppClick));
                container3._customEnterId=container3.connect('enter-event',Lang.bind(this,this._onAppEnter));
                container3._customLeaveId=container3.connect('leave-event',Lang.bind(this,this._onAppLeave));
                container3._customDestroyId=container3.connect('destroy',Lang.bind(this,this._onAppDestroy));
                container3._customPseudoClass='active';

                container2.add(container3, {x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
                container.add(container2, { row: this.posy, col: this.posx, x_fill: false, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.START});
                this.posx+=1;
                if (this.posx==4) {
                    this.posx=0;
                    this.posy+=1;
                }
            }
        }
        
        for (var counter2=shown_icons;counter2<ICONS_PER_PAGE;counter2+=1) {
            let container2=new St.BoxLayout({vertical: true, style_class:'slingshot_table_element'})
            container.add(container2, { row: this.posy, col: this.posx, x_fill: false, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.START});
            this.posx+=1;
            if (this.posx==4) {
                this.posx=0;
                this.posy+=1;
            }
        }

        if (this.icon_counter>ICONS_PER_PAGE) {
            this.pagesVisibleInMenu=0;
            var pages=new St.BoxLayout({vertical: false});
            for (var i=0;i<=(this.icon_counter/ICONS_PER_PAGE);i++) {
                let clase='';
                if (i==this.currentPageVisibleInMenu) {
                    clase='active';
                }
                let texto=(i+1).toString();
                let page_label = new St.Label({text: texto,style_class:'popup-menu-item',pseudo_class:clase, reactive: true});

                page_label._page_assigned=i;
                page_label._customEventId=page_label.connect('button-release-event',Lang.bind(this,this._onPageClick));
                page_label._customDestroyId=page_label.connect('destroy',Lang.bind(this,this._onDestroyActor));
                pages.add(page_label, {y_align:St.Align.END});
                this.pagesVisibleInMenu+=1;
            }
            this.mainContainer.add(pages, {row: 1, col: 1, x_fill: false, y_fill: false, y_expand: false, x_align: St.Align.MIDDLE, y_align: St.Align.END});
        } else {
            this.pagesVisibleInMenu=1;
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
        this.mainContainer = new St.Table({homogeneous: false});
        this.classContainer = new St.BoxLayout({vertical: true, style_class: 'slingshot_class_list'});
        this.globalContainer = new St.Table({ homogeneous: false, reactive: true});
        this.iconsContainer = new St.Table({ homogeneous: true});
        this.mainContainer.add(this.classContainer, {row: 0, col:0, x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.globalContainer.add(this.iconsContainer, {row: 0, col:0, x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
        this.mainContainer.add(this.globalContainer, {row: 0, col:1, x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});

        let tree = this._appSys.get_tree();
        let root = tree.get_root_directory();

        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let dir = iter.get_directory();
                let categoryName=dir.get_name();
                if (this.currentSelection=='') {
                    this.currentSelection=categoryName;
                    this.currentPageVisibleInMenu=0;
                }

                let item = new St.Label({text: categoryName, style_class:'popup-menu-item', reactive: true});
                item._group_name=categoryName;
                item._customEventId=item.connect('button-release-event',Lang.bind(this,this._onCategoryClick));
                item._customDestroyId=item.connect('destroy',Lang.bind(this,this._onDestroyActor));
                this.classContainer.add(item);

                if (categoryName==this.currentSelection) {
                    item.set_style_pseudo_class('active');
                    this._loadCategory(this.iconsContainer,dir,item.menu);
                }
            }
        }

        if (this.pagesVisibleInMenu>1) {
            this.globalContainer._customEventId=this.globalContainer.connect('scroll-event', Lang.bind(this,this._onScrollWheel));
            this.globalContainer._customDestroyId=this.globalContainer.connect('destroy',Lang.bind(this,this._onDestroyActor));
        }

        if(this._activitiesNoVisible) {
        	   // one empty element to separate ACTIVITIES from the list
							    let item = new St.Label({text: ' ', style_class:'popup-menu-item', reactive: false});
            this.classContainer.add(item);
            
            item = new St.Label({text: _("Activities"), style_class:'popup-menu-item', reactive: true});
            this.mainContainer.add(item, {row: 2, col: 0, x_fill: false, y_fill: false, y_expand: false, x_align: St.Align.START, y_align: St.Align.END});
            item._customEventId=item.connect('button-release-event',Lang.bind(this,this._onActivitiesClick));
            item._customDestroyId=item.connect('destroy',Lang.bind(this,this._onDestroyActor));
        }

        let ppal = new SlingShotItem(this.mainContainer,'',{reactive:false});
        this.menu.removeAll();
        this.menu.addMenuItem(ppal);
    },

    _onActivitiesClick: function(actor,event) {
        Main.overview.show();
    },

    _onScrollWheel : function(actor,event) {
        let direction = event.get_scroll_direction();
        if ((direction == Clutter.ScrollDirection.DOWN) && (this.currentPageVisibleInMenu<(this.pagesVisibleInMenu-1))) {
            this.currentPageVisibleInMenu+=1;
            this._display();
        }
        if ((direction == Clutter.ScrollDirection.UP) && (this.currentPageVisibleInMenu>0)) {
            this.currentPageVisibleInMenu-=1;
            this._display();
        }
    },

    _onCategoryClick : function(actor,event) {
        this.currentSelection=actor._group_name;
        this.currentPageVisibleInMenu=0;
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
        this.currentPageVisibleInMenu=actor._page_assigned;
        this._display();
    },

    _onDestroyActor : function(actor,event) {
        actor.disconnect(actor._customEventId);
        actor.disconnect(actor._customDestroyId);
    },

    _onAppEnter : function(actor,event) {
        actor.set_style_pseudo_class(actor._customPseudoClass);
    },

    _onAppLeave : function(actor,event) {
        actor.set_style_pseudo_class('');
    },

    _onAppDestroy : function(actor,event) {
        actor.disconnect(actor._customEventId);
        actor.disconnect(actor._customDestroyId);
        actor.disconnect(actor._customEnterId);
        actor.disconnect(actor._customLeaveId);
    },

    _onOpenStateChanged: function(menu, open) {
        this.parent(menu,open);
        this._display();
    },
    
    _onChangedSetting: function(key) {
        this._onSetActivitiesHotspot();
        this._onSetActivitiesStatus();
    },
    
    _onSetActivitiesStatus: function() {
        this._setActivitiesNoVisible(settings.get_boolean("show-activities"));
    },
    
    _setActivitiesNoVisible: function(mode) {
        this._activitiesNoVisible=mode;
        if (mode) {
            if (ShellVersion[1]>4) {
                let indicator = Main.panel.statusArea['activities'];
                if(indicator != null)
                    indicator.container.hide();
            } else {
                Main.panel._activitiesButton.actor.hide();
            }
        } else {
            if (ShellVersion[1]>4) {
                let indicator = Main.panel.statusArea['activities'];
                if(indicator != null)
                    indicator.container.show();
            } else {
                Main.panel._activitiesButton.actor.show();
            }
        }
    },
    
    _onSetActivitiesHotspot: function() {
        this._setActivitiesNoHotspot(settings.get_boolean("disable-activities-hotspot"));
    },
    
    _setActivitiesNoHotspot: function(mode) {
        if (mode) {
            if (ShellVersion[1]>4) {
                Main.panel.statusArea['activities'].hotCorner._corner.hide();
            } else {
                Main.panel._activitiesButton._hotCorner._corner.hide();
            }
            Main.layoutManager._hotCorners.forEach(function(hotCorner) { hotCorner._corner.hide(); });
        } else {
            if (ShellVersion[1]>4) {
                Main.panel.statusArea['activities'].hotCorner._corner.show();
            } else {
                Main.panel._activitiesButton._hotCorner._corner.show();
            }
            Main.layoutManager._hotCorners.forEach(function(hotCorner) { hotCorner._corner.show(); });
        }
    }
    
});

let SlingShotButton;

function enable() {
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
    settings = Lib.getSettings(SCHEMA);
}

