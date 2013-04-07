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
    7: Better use of standard CSS
       Tries to keep the size of the meny as steady as possible, by
       tracking the maximum size used
    8: Reduces the icon matrix when the screen is small (based on code
       from kirby33)
       Now doesn't show empty pages
       Allows to customize the style of the main button (with/out icon
       or text)
    9: Allows to choose between categories mode or pure icon mode
       Now highlights all the possible buttons
   10: Keeps the window size even when changing the mode
   11: Allows to search apps using the keyboard
       Better appearance
   12: Opens the menu with the Right Windows key (Left Windows key still
       goes to Overview mode)
   13: Right Windows key shows AND closes the menu
   14: Improved icons
   15: Added configuration icon
       Only shows the SEARCH box when typing
   16: Allows to change the main button position in the top bar
       Allows to change the hot key for opening the menu
   17: The size adjustment works again
   18: Added a RESET button for the hotkey configuration entry
   19: Allows to set the icon size
   20: Refactorized code to better follow the Gnome coding style
   21: Adapted to Gnome Shell 3.8 (forced to remove Disable HotSpot)
       Now ensures that the menu is hidden when enabling Overview mode)
    
*/

const ShellVersion = imports.misc.config.PACKAGE_VERSION.split(".");
const Clutter = imports.gi.Clutter;
const GMenu = imports.gi.GMenu;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const SlingShot_App_Launcher = imports.misc.extensionUtils.getCurrentExtension();
const Lib = SlingShot_App_Launcher.imports.lib;

const LayoutManager = Main.layoutManager;

const SCHEMA = 'org.gnome.shell.extensions.slingshot_app_launcher';

const SlingShotItem = new Lang.Class({
    Name: 'SlingShot.SlingShotItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (container,app, params) {
        this.parent(params);

        this._app = app;
        this.addActor(container);
    }
});

var relaunchIdle = null;

const INIT_ICONS_PER_ROW = 4;
const INIT_ICONS_PER_COLUMN = 3;

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
        this._baseWidth=1.0;
        this._baseHeight=1.0;
        this._baseIconsPerRow = INIT_ICONS_PER_ROW;
        this._baseIconsPerColumn = INIT_ICONS_PER_COLUMN;
        this._appSearch=[];

        this._currentWidth=this._baseWidth;
        this._currentHeight=this._baseHeight;
        this._iconsPerRow = this._baseIconsPerRow;
        this._iconsPerColumn = this._baseIconsPerColumn;

        this._settings = Lib.getSettings(SCHEMA);
        this._showFirst = this._settings.get_boolean("show-first");
        this._iconSize = this._settings.get_int("icon-size");

        this._searchText = "";

        this._monitor = LayoutManager.monitors[LayoutManager.primaryIndex];

        this.parent(0.0,'SlingShot');
        this.actor.add_style_class_name('panel-status-button');
        this._box = new St.BoxLayout({ style_class: 'panel-status-button-box' });
        this.actor.add_actor(this._box);

        this.buttonIcon = new St.Icon({ gicon: null, style_class: 'system-status-icon' });
        this.buttonIcon.icon_name='start-here';
        this._box.add_actor(this.buttonIcon);
        this.buttonLabel = new St.Label({ text: _("Applications")});
        this._box.add_actor(this.buttonLabel);

        this._onChangedSetting();
        this._settingBind=this._settings.connect('changed',Lang.bind(this,this._onChangedSetting));

        this._appSys = Shell.AppSystem.get_default();
        this._installedChangedId = this._appSys.connect('installed-changed', Lang.bind(this, this._refresh));
        this._fillCategories();

        this._keyPressEvent1=this.menu.actor.connect('key-press-event', Lang.bind(this,this._keyPressed1));

        global.display.add_keybinding('key-binding',this._settings,Meta.KeyBindingFlags.NONE, Lang.bind(this,this._keyPressed2));

        this._display();
    },

    _keyPressed2 : function(actor, event) {

        this.menu.open();
    },

    _keyPressed1 : function(actor, event) {

        let modifiers = event.get_state();
        let symbol = event.get_key_symbol();
        let refreshSearch=false;
        let retval=false;

        if (symbol == Clutter.Super_R) {
            this.menu.close();
        } else if (symbol == Clutter.BackSpace) {
            if (this._searchText.length>0) {
                this._searchText=this._searchText.substr(0,this._searchText.length-1);
                refreshSearch=true;
            }
            retval=true;
        } else if (symbol == Clutter.Tab) {
            if ((this._searchText!="")&&(this._appSearch.length>0)) {
                let tmpApp = this._appSearch[0];
                this._appSearch.splice(0,1);
                this._appSearch.push(tmpApp);
                this._display();
            }
            retval=true;
        } else if (symbol == Clutter.Return) {
            if ((this._searchText!="")&&(this._appSearch.length>0)) {
                this._appSearch[0].open_new_window(-1);
                this.menu.close();
            }
            retval=true;
        } else {
            let letter=Clutter.keysym_to_unicode(symbol);
            if (letter!=0) {
                this._searchText+=String.fromCharCode(letter);
                refreshSearch=true;
                retval=true;
            }
        }

        if (refreshSearch) {
            this._appSearch=[];
            for(let item in this._appList) {
                let app=this._appList[item];
                let texto = app.get_name();
                if (texto.toLowerCase().indexOf(this._searchText.toLowerCase())!=-1) {
                    this._appSearch.push(app);
                }
            }
            this._appSearch.sort(this._sortApps);
            this._display();
        }
        return retval;
    },

    destroy: function() {
        this._settings.disconnect(this._settingBind);
        this._setActivitiesNoVisible(false);
        this._setActivitiesNoHotspot(false);
        this._appSys.disconnect(this._installedChangedId);
        this.menu.actor.disconnect(this._keyPressEvent1);
        global.display.remove_keybinding('key-binding');
        this.parent();
    },

    _refresh: function() {
        this._fillCategories();
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

    _fillCategories: function() {

        this._appList=[];
        this._appClass=[];

        let tree = this._appSys.get_tree();
        let root = tree.get_root_directory();

        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let dir = iter.get_directory();
                let childrens=[];
                this._fillCategories2(dir,childrens);
                if (childrens.length==0) {
                    continue;
                }
                childrens.sort(this._sortApps);
                let item = { dirItem: dir, dirChilds: childrens };
                this._appClass.push(item);
            }
        }
        this._appList.sort(this._sortApps);
    },

    _fillCategories2: function(dir,childrens) {

        let iter = dir.iter();
        let nextType;

        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                let entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    let app = this._appSys.lookup_app_by_tree_entry(entry);
                    childrens.push(app);
                    this._appList.push(app);
                }
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                this._fillCategories2(iter.get_directory(), childrens);
            }
        }
    },

    _paintIcons: function(container,appList,width) {

        this.posx=0;
        this.posy=0;
        this.iconCounter=0;

        let iconsPerPage=width*this._iconsPerColumn;
        let minimumCounter=this.currentPageVisibleInMenu*iconsPerPage;
        let maximumCounter=(this.currentPageVisibleInMenu+1)*iconsPerPage;

        let shownIcons=0;
        var labelWidth;
        
        labelWidth = this._iconSize+32;
        if (labelWidth < 80) {
            labelWidth=80;
        }
        if (labelWidth >120) {
            labelWidth=120;
        }
        for (let item in appList) {
            this.iconCounter++;
            if ((this.iconCounter>minimumCounter)&&(this.iconCounter<=maximumCounter)) {
                shownIcons++;
                let app=appList[item];
                let icon = app.create_icon_texture(this._iconSize);
                let texto = new St.Label({text:app.get_name(), style_class: 'slingshot_table',width: labelWidth});

                let container2=new St.BoxLayout({vertical: true, reactive: true, style_class:'popup-menu-item'});

                texto.clutter_text.line_wrap_mode = Pango.WrapMode.WORD;
                texto.clutter_text.line_wrap = true;
                //texto.clutter_text.line_ellipsize_mode = Pango.EllipsizeMode.END;

                container2.add(icon, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.START});
                container2.add(texto, {x_fill: true, y_fill: true,x_align: St.Align.MIDDLE, y_align: St.Align.START});
                container2._app=app;
                container2._customEventId=container2.connect('button-release-event',Lang.bind(this,this._onAppClick));
                container2._customEnterId=container2.connect('enter-event',Lang.bind(this,this._onAppEnter));
                container2._customLeaveId=container2.connect('leave-event',Lang.bind(this,this._onAppLeave));
                container2._customDestroyId=container2.connect('destroy',Lang.bind(this,this._onAppDestroy));
                container2._customPseudoClassActive='active';
                container2._customPseudoClassInactive='';

                container.add(container2, { row: this.posy, col: this.posx, x_fill: false, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.START});

                this.posx++;
                if (this.posx==width) {
                    this.posx=0;
                    this.posy++;
                }
            }
        }

        for (let counter2=shownIcons;counter2<iconsPerPage;counter2+=1) {
            let texto = new St.Label({text:" "});
            texto.width=this._iconSize;
            texto.height=this._iconSize;
            let texto2 = new St.Label({text:" \n \n ", style_class: 'slingshot_table',width: labelWidth});
            let container2=new St.BoxLayout({vertical: true, style_class:'popup-menu-item'})
            container2.add(texto, {x_fill: false, y_fill: false,x_align: St.Align.MIDDLE, y_align: St.Align.START});
            container2.add(texto2, {x_fill: true, y_fill: true,x_align: St.Align.MIDDLE, y_align: St.Align.START});
            container.add(container2, { row: this.posy, col: this.posx, x_fill: false, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.START});
            this.posx++;
            if (this.posx==width) {
                this.posx=0;
                this.posy++;
            }
        }
    },

    _repaintMenu : function() {

        Mainloop.source_remove(this._updateRegionIdle);
        delete this._updateRegionIdle;
        this._currentWidth=this._baseWidth;
        this._currentHeight=this._baseHeight;
        this._display();
        return (false);
    },

    _menuSizeChanged : function(actor,event) {

        actor._customRealized=true;
        if ((this.iconsContainer._customRealized==false) || (this.classContainer._customRealized==false)) {
            return;
        }

        if (actor!=this.iconsContainer) {
            return;
        }

        let doRefresh=false;
        if (((this.iconsContainer.width+this.classContainer.width)>((this._monitor.width*7)/8))&&(this._iconsPerRow>1)) {
            this._iconsPerRow-=1;
            doRefresh=true;
        }
        if (((this.iconsContainer.height)>((this._monitor.height*4)/6))&&(this._iconsPerColumn>1)) {
            this._iconsPerColumn-=1;
            doRefresh=true;
        }
        if (doRefresh) {
            this._updateRegionIdle = Mainloop.idle_add(Lang.bind(this, this._repaintMenu),0);
        }
    },

    _display : function() {
    
        let paintCategories = this._settings.get_boolean('show-categories');
        let paintSearch=false;

        this.mainContainer = new St.Table({homogeneous: false});
        this.baseContainer = new St.Table({homogeneous: false});
        this.searchContainer = new St.BoxLayout({vertical: false});
        this.searchLabel = new St.Label({text: this._searchText});
        this.upperContainer = new St.BoxLayout({vertical: false});

        if (this._searchText!="") {
            paintCategories=false;
            paintSearch=true;
        }

        this.globalContainer = new St.Table({ homogeneous: false, reactive: true});
        this.iconsContainer = new St.Table({ homogeneous: true});
        this.globalContainer.add(this.iconsContainer, {row: 0, col:0, x_fill:true, y_fill: true, x_expand: true, y_expand:true, x_align: St.Align.START, y_align: St.Align.START});

        let iconCol;
        if(paintCategories) {
            iconCol=1;
        } else {
            iconCol=0;
        }

        if (paintSearch==false) {
            let icon1 = new St.Icon({icon_name: 'categories-symbolic',icon_size: 24});
            let iconBin1=new St.BoxLayout({reactive: true, style_class:'popup-menu-item'});
            iconBin1.add(icon1, {x_fill:true, y_fill: false,x_align: St.Align.START, y_align: St.Align.START});
            let icon2 = new St.Icon({icon_name: 'icons-symbolic',icon_size: 24});
            let iconBin2=new St.BoxLayout({reactive: true, style_class:'popup-menu-item'});
            iconBin2.add(icon2, {x_fill:true, y_fill: false,x_align: St.Align.START, y_align: St.Align.START});
            let icon3 = new St.Icon({icon_name: 'slingshot-preferences-symbolic',icon_size: 24});
            let iconBin3=new St.BoxLayout({reactive: true, style_class:'popup-menu-item'});
            iconBin3.add(icon3, {x_fill:true, y_fill: false,x_align: St.Align.START, y_align: St.Align.START});
            this.upperContainer.add(iconBin1, {x_fill:true, y_fill: false,x_align: St.Align.START, y_align: St.Align.MIDDLE});
            this.upperContainer.add(iconBin2, {x_fill:true, y_fill: false,x_align: St.Align.START, y_align: St.Align.MIDDLE});
            this.upperContainer.add(iconBin3, {x_fill:true, y_fill: false,x_align: St.Align.START, y_align: St.Align.MIDDLE});
        
            iconBin1._customEventId=iconBin1.connect('button-release-event',Lang.bind(this,this._onCategoriesClick));
            iconBin1._customEnterId=iconBin1.connect('enter-event',Lang.bind(this,this._onAppEnter));
            iconBin1._customLeaveId=iconBin1.connect('leave-event',Lang.bind(this,this._onAppLeave));
            iconBin1._customDestroyId=iconBin1.connect('destroy',Lang.bind(this,this._onAppDestroy));
            iconBin1._customPseudoClassActive='active';
            iconBin1._customPseudoClassInactive='';

            iconBin2._customEventId=iconBin2.connect('button-release-event',Lang.bind(this,this._onIconsClick));
            iconBin2._customEnterId=iconBin2.connect('enter-event',Lang.bind(this,this._onAppEnter));
            iconBin2._customLeaveId=iconBin2.connect('leave-event',Lang.bind(this,this._onAppLeave));
            iconBin2._customDestroyId=iconBin2.connect('destroy',Lang.bind(this,this._onAppDestroy));
            iconBin2._customPseudoClassActive='active';
            iconBin2._customPseudoClassInactive='';

            iconBin3._customEventId=iconBin3.connect('button-release-event',Lang.bind(this,this._onSettingsClick));
            iconBin3._customEnterId=iconBin3.connect('enter-event',Lang.bind(this,this._onAppEnter));
            iconBin3._customLeaveId=iconBin3.connect('leave-event',Lang.bind(this,this._onAppLeave));
            iconBin3._customDestroyId=iconBin3.connect('destroy',Lang.bind(this,this._onAppDestroy));
            iconBin3._customPseudoClassActive='active';
            iconBin3._customPseudoClassInactive='';
        } else {
            let icon4 = new St.Icon({icon_name: 'edit-find-symbolic',icon_size: 24});
            this.searchContainer.add(icon4, {x_fill:false, y_fill: false,x_align: St.Align.START, y_align: St.Align.MIDDLE});
            this.searchContainer.add(this.searchLabel, {row: 0, col: 1,x_fill:true, y_fill: false, x_expand: true,y_expand: false, x_align: St.Align.END, y_align: St.Align.MIDDLE});
            this.upperContainer.add(this.searchContainer, {x_fill:true, y_fill: false, expand: true, x_align: St.Align.END, y_align: St.Align.MIDDLE});
        }

        this.mainContainer.add(this.upperContainer,{row: 0, col:0, x_expand: true, y_expand: false, x_fill: true, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.START});
        
        if (paintCategories) {
            this.classContainer = new St.BoxLayout({vertical: true, style_class: 'slingshot_class_list'});
            this.mainContainer.add(this.classContainer, {row: 1, col:0, x_fill:false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START});
            this.classContainer._customRealized=false;
            this.classContainer._customEventId=this.classContainer.connect_after('realize',Lang.bind(this,this._menuSizeChanged));
            this.classContainer._customDestroyId=this.classContainer.connect('destroy',Lang.bind(this,this._onDestroyActor));
        } else {
            this.classContainer = {_customRealized:true, width:0, height:0};
        }

        this.mainContainer.add(this.globalContainer, {row: 1, col:iconCol, x_fill:true, y_fill: true, x_expand: true, y_expand:true, x_align: St.Align.START, y_align: St.Align.START});

        this.mainContainer.add(this.baseContainer,{row: 2, col:0, col_span: iconCol+1, x_fill: true, y_fill: false, x_align: St.Align.START, y_align: St.Align.END});

        this.iconsContainer._customRealized=false;
        this.iconsContainer._customEventId=this.iconsContainer.connect_after('realize',Lang.bind(this,this._menuSizeChanged));
        this.iconsContainer._customDestroyId=this.iconsContainer.connect('destroy',Lang.bind(this,this._onDestroyActor));

        this.searchContainer._customRealized=false;
        this.searchContainer._customEventId=this.searchContainer.connect_after('realize',Lang.bind(this,this._menuSizeChanged));
        this.searchContainer._customDestroyId=this.searchContainer.connect('destroy',Lang.bind(this,this._onDestroyActor));

        let iconsPerPage=this._iconsPerRow*this._iconsPerColumn;
        if (paintCategories) {
            for (let i=0; i<this._appClass.length; i++) {
                let dItem= this._appClass[i];
                let dir = dItem.dirItem;
                let categoryName=dir.get_name();
                if (this.currentSelection=='') {
                    this.currentSelection=categoryName;
                    this.currentPageVisibleInMenu=0;
                }

                let item = new St.Label({text: categoryName, style_class:'popup-menu-item', reactive: true});
                item._group_name=categoryName;
                item._customEventId=item.connect('button-release-event',Lang.bind(this,this._onCategoryClick));
                item._customEnterId=item.connect('enter-event',Lang.bind(this,this._onAppEnter));
                item._customLeaveId=item.connect('leave-event',Lang.bind(this,this._onAppLeave));
                item._customDestroyId=item.connect('destroy',Lang.bind(this,this._onAppDestroy));
                item._customPseudoClassActive='active';
                item._customPseudoClassInactive='';
                this.classContainer.add(item);

                if (categoryName==this.currentSelection) {
                    item.set_style_pseudo_class('active');
                    item._customPseudoClassInactive='active';
                    this._paintIcons(this.iconsContainer,dItem.dirChilds,this._iconsPerRow);
                }
            }
        } else {
            if (paintSearch) {
                this._paintIcons(this.iconsContainer,this._appSearch,this._iconsPerRow+1);
            } else {
                this._paintIcons(this.iconsContainer,this._appList,this._iconsPerRow+1);
            }
            iconsPerPage+=this._iconsPerColumn;
        }

        let pages=new St.BoxLayout({vertical: false});
        if (this.iconCounter>iconsPerPage) {
            this.pagesVisibleInMenu=0;
            for (let i=0;i<=((this.iconCounter-1)/iconsPerPage);i++) {
                let clase='';
                if (i==this.currentPageVisibleInMenu) {
                    clase='active';
                }
                let texto=(i+1).toString();
                let page_label = new St.Label({text: texto,style_class:'popup-menu-item',pseudo_class:clase, reactive: true});

                page_label._page_assigned=i;
                page_label._customEventId=page_label.connect('button-release-event',Lang.bind(this,this._onPageClick));
                page_label._customEnterId=page_label.connect('enter-event',Lang.bind(this,this._onAppEnter));
                page_label._customLeaveId=page_label.connect('leave-event',Lang.bind(this,this._onAppLeave));
                page_label._customDestroyId=page_label.connect('destroy',Lang.bind(this,this._onAppDestroy));
                page_label._customPseudoClassActive='active';
                if (i==this.currentPageVisibleInMenu) {
                    page_label._customPseudoClassInactive='active';
                } else {
                    page_label._customPseudoClassInactive='';
                }
                pages.add(page_label, {y_align:St.Align.START});
                this.pagesVisibleInMenu+=1;
            }
        } else {
            this.pagesVisibleInMenu=1;
            let page_label = new St.Label({text: " ",style_class:'popup-menu-item', reactive: true});
            pages.add(page_label, {y_align:St.Align.START});
        }

        if (this.pagesVisibleInMenu>1) {
            this.globalContainer._customEventId=this.globalContainer.connect('scroll-event', Lang.bind(this,this._onScrollWheel));
            this.globalContainer._customDestroyId=this.globalContainer.connect('destroy',Lang.bind(this,this._onDestroyActor));
        }

        if(this._activitiesNoVisible) {
            // one empty element to separate ACTIVITIES from the list
            if (paintCategories) {
                let item = new St.Label({text: ' ', style_class:'popup-menu-item', reactive: false});
                this.classContainer.add(item);
            }
            
            let item = new St.Label({text: _("Activities"), style_class:'popup-menu-item', reactive: true});
            item._customEventId=item.connect('button-release-event',Lang.bind(this,this._onActivitiesClick));
            item._customEnterId=item.connect('enter-event',Lang.bind(this,this._onAppEnter));
            item._customLeaveId=item.connect('leave-event',Lang.bind(this,this._onAppLeave));
            item._customDestroyId=item.connect('destroy',Lang.bind(this,this._onAppDestroy));
            item._customPseudoClassActive='active';
            item._customPseudoClassInactive='';
            this.baseContainer.add(item, {row: 0, col: 0, x_fill: false, y_fill: false, x_expand: false, y_expand: false, x_align: St.Align.START, y_align: St.Align.END});
            this.baseContainer.add(pages, {row: 0, col: 1, x_fill: false, y_fill: false, x_expand: true, y_expand: false, x_align: St.Align.MIDDLE, y_align: St.Align.END});
        } else {
            this.baseContainer.add(pages, {row: 0, col: 0, x_fill: false, y_fill: false, y_expand: false, x_align: St.Align.MIDDLE, y_align: St.Align.END});
        }

        let ppal = new SlingShotItem(this.mainContainer,'',{reactive:false});
        this.menu.removeAll();
        this.menu.addMenuItem(ppal);
        
            let color = this.upperContainer.get_theme_node().get_foreground_color();
            let red=color.red.toString(16);
            let green=color.green.toString(16);
            let blue=color.blue.toString(16);
            if (red.length==1) {
                red="0"+red;
            }
            if (green.length==1) {
                green="0"+green;
            }
            if (blue.length==1) {
                blue="0"+blue;
            }

        if (paintSearch) {
            let newStyle="border-color: #"+red+green+blue+"; border-width: 2px; border-radius: 5px;";
            this.searchContainer.set_style(newStyle);
        }
        if (paintCategories) {
            this.classContainer.set_style("border-color: #"+red+green+blue+"; border-top-width: 1px;border-right-width: 1px;");
        }

        // These lines are to ensure that the menu and the icons keep always the maximum size needed
        if (this._currentWidth<=this.mainContainer.width) {
            this._currentWidth=this.mainContainer.width;
        }
        this.mainContainer.width=this._currentWidth;
        if (this._currentHeight<=this.mainContainer.height) {
            this._currentHeight=this.mainContainer.height;
        }
        this.mainContainer.height=this._currentHeight;
    },
    
    _onSettingsClick: function(actor,event) {
        let extension = imports.misc.extensionUtils.getCurrentExtension();
        let metadata = extension.metadata;
        let _appSys = Shell.AppSystem.get_default();
        let _gsmPrefs = _appSys.lookup_app('gnome-shell-extension-prefs.desktop');
        if (_gsmPrefs.get_state() == _gsmPrefs.SHELL_APP_STATE_RUNNING){
            _gsmPrefs.activate();
        } else {
            _gsmPrefs.launch(global.display.get_current_time_roundtrip(),[metadata.uuid],-1,null);
        }
        this.menu.close();
    },

    _onActivitiesClick: function(actor,event) {
        this.menu.close();
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

    _changeShape : function() {

        this._baseWidth=this._currentWidth;
        this._baseHeight=this._currentHeight;
        this._baseIconsPerRow = this._IconsPerRow;
        this._baseIconsPerColumn = this._IconsPerColumn;

        this.currentPageVisibleInMenu=0;
        this._display();
    },

    _onCategoriesClick : function(actor,event) {
        if (false==this._settings.get_boolean('show-categories')) {
            this._settings.set_boolean('show-categories',true);
            this._changeShape();
        }
    },

    _onIconsClick : function(actor,event) {
        if (true==this._settings.get_boolean('show-categories')) {
            this._settings.set_boolean('show-categories',false);
            this._changeShape();
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
        actor.set_style_pseudo_class(actor._customPseudoClassActive);
    },

    _onAppLeave : function(actor,event) {
        actor.set_style_pseudo_class(actor._customPseudoClassInactive);
    },

    _onAppDestroy : function(actor,event) {
        actor.disconnect(actor._customEventId);
        actor.disconnect(actor._customDestroyId);
        actor.disconnect(actor._customEnterId);
        actor.disconnect(actor._customLeaveId);
    },

    _onOpenStateChanged: function(menu, open) {
        this._searchText = "";
        this.parent(menu,open);
        this._display();
    },

    _onChangedSetting: function(key) {
        this._onSetActivitiesHotspot();
        this._onSetActivitiesStatus();
        this._onSetButtonStyle();
        if (this._showFirst != this._settings.get_boolean("show-first")) {
            relaunchIdle = Mainloop.idle_add(tmp_relaunch,0);
        }
        if (this._iconSize != this._settings.get_int("icon-size")) {
            this._iconSize = this._settings.get_int("icon-size");
            this._baseWidth=1.0;
            this._baseHeight=1.0;
            this._baseIconsPerRow = INIT_ICONS_PER_ROW;
            this._baseIconsPerColumn = INIT_ICONS_PER_COLUMN;
            this._currentWidth=this._baseWidth;
            this._currentHeight=this._baseHeight;
            this._iconsPerRow = this._baseIconsPerRow;
            this._iconsPerColumn = this._baseIconsPerColumn;
        }
    },

    _onSetButtonStyle: function() {
        switch(this._settings.get_enum('menu-button')) {
        case 0: // text and icon
            this.buttonIcon.show();
            this.buttonLabel.show();
        break;
        case 1: // only icon
            this.buttonIcon.show();
            this.buttonLabel.hide();
        break;
        case 2: // only text
            this.buttonIcon.hide();
            this.buttonLabel.show();
        break;
        }
    },

    _onSetActivitiesStatus: function() {
        this._setActivitiesNoVisible(this._settings.get_boolean('hide-activities'));
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
        this._setActivitiesNoHotspot(this._settings.get_boolean("disable-activities-hotspot"));
    },

    _setActivitiesNoHotspot: function(mode) {

        // Can't disable hotspots on Gnome Shell 3.8 :-(
        if ((ShellVersion[0]!=3)||(ShellVersion[1]>6)) {
            return;
        }

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

function tmp_relaunch() {

    if (relaunchIdle!=null) {
        Mainloop.source_remove(relaunchIdle);
    }
    disable();
    enable();
}

function enable() {
    SlingShotButton = new ApplicationsButton();

    let pos=1;
    if ((SlingShotButton._settings.get_boolean("show-first"))||(SlingShotButton._settings.get_boolean('hide-activities'))) {
        pos=0;
    }

    if (ShellVersion[1]>4) {
        Main.panel.addToStatusArea('slingshot-menu', SlingShotButton, pos, 'left');
    } else {
        Main.panel._leftBox.insert_child_at_index(SlingShotButton.actor,pos);
        Main.panel._menus.addMenu(SlingShotButton.menu);
    }
}

function disable() {
    SlingShotButton.destroy();
}

function init(extensionMeta) {
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionMeta.path + "/icons");
}

