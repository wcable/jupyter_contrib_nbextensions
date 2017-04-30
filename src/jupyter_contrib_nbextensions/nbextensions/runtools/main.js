// Add toolbar buttons for extended code execution commands

define([
    'base/js/namespace',
    'jquery',
    'require',
    'base/js/events',
    'services/config',
    'base/js/utils',
    'codemirror/lib/codemirror'
],   function(Jupyter, $, require, events, configmod, utils, CodeMirror) {
    "use strict";

    var base_url = utils.get_body_data("baseUrl");
    var config = new configmod.ConfigSection('notebook', {base_url: base_url});
    var run_list = [];  /* list of cells to be run */

    // define default config parameter values
    var params = {
        show_cellstate : false,
        run_cells_above : 'Alt-a',
        run_cells_below : 'Alt-b',
        toggle_marker : 'Alt-t',
        mark_all_codecells : 'Alt-m',
        unmark_all_codecells : 'Alt-u',
        run_marked_cells : 'Alt-r',
        run_all_cells : 'Alt-x',
        run_all_cells_ignore_errors : 'Alt-f',
        stop_execution : 'Ctrl-c',
        marked_color : '#0f0',
        scheduled_color : '#00f',
        run_color : '#f5f5f5'
    };

    // updates default params with any specified in the provided config data
    var update_params = function (config_data) {
        for (var key in params) {
            if (config_data.hasOwnProperty(key)) {
                params[key] = config_data[key];
            }
        }
    };

    config.loaded.then(function() {
         /* Add run control buttons to toolbar */
        Jupyter.toolbar.add_buttons_group([
                {
                    id : 'toggle_runtools',
                    label : 'Toggle Runtools Toolbar',
                    icon : 'fa-cogs',
                    callback : function () {
                        toggle_toolbar();
                        }
                }
             ]);
        $("#toggle_runtools").css({'outline' : 'none'});

        /* Add keyboard shortcuts */
        var add_command_shortcuts = {};
        add_command_shortcuts[params["run_cells_above"]] = {
                help    : 'Run cells above',
                help_index : 'xa',
                handler : function() {
                    var mode = Jupyter.notebook.get_selected_cell().mode;
                    Jupyter.notebook.execute_cells_above();
                    Jupyter.notebook.select_next();
                    var type = Jupyter.notebook.get_selected_cell().cell_type;
                    if (mode == "edit" && type == "code") Jupyter.notebook.edit_mode();
                    return false;
                }
            };
        add_command_shortcuts[params["run_cells_below"]] = {
                help    : 'Run cells below',
                help_index : 'aa',
                handler : function() {
                    var mode = Jupyter.notebook.get_selected_cell().mode;
                    Jupyter.notebook.execute_cells_below();
                    var type = Jupyter.notebook.get_selected_cell().cell_type;
                    if (mode == "edit" && type == "code") Jupyter.notebook.edit_mode();
                    return false;
                }
            };
        add_command_shortcuts[params["toggle_marker"]] = {
                help    : 'Toggle marker',
                help_index : 'mt',
                handler : function() {
                    toggle_marker();
                    return false;
                }
            };
        add_command_shortcuts[params["mark_all_codecells"]] = {
                help    : 'Mark all codecells',
                help_index : 'ma',
                handler : function() {
                    mark_all();
                    return false;
                }
            };
        add_command_shortcuts[params["unmark_all_codecells"]] = {
                help    : 'Unmark all codecells',
                help_index : 'mu',
                handler : function() {
                    mark_none();
                    return false;
                }
            };
        add_command_shortcuts[params["run_marked_cells"]] = {
                help    : 'Run marked cells',
                help_index : 'rm',
                handler : function() {
                    run_marked_cells();
                    return false;
                }
            };
        add_command_shortcuts[params["run_all_cells"]] = {
                help    : 'Run all cells',
                help_index : 'ra',
                handler : function() {
                    var pos = Jupyter.notebook.element.scrollTop();
                    var ic = Jupyter.notebook.get_selected_index();
                    Jupyter.notebook.execute_all_cells();
                    Jupyter.notebook.select(ic);
                    Jupyter.notebook.element.animate({scrollTop:pos}, 100);
                    return false;
                }
            };
        add_command_shortcuts[params["run_all_cells_ignore_errors"]] = {
                help    : 'Run all cells - ignore errors',
                help_index : 'rf',
                handler : function() {
                    run_all_cells_ignore_errors();
                    return false;
                }
            };
        Jupyter.keyboard_manager.command_shortcuts.add_shortcuts(add_command_shortcuts);
        Jupyter.keyboard_manager.edit_shortcuts.add_shortcuts(add_command_shortcuts);

        if (params["show_cellstate"] === true) {
            events.on('create.CodeCell', function (event, nbcell) {
                var cell = nbcell.cell;
                set_cell_state(cell, 'created');
            });
            events.on('execute.CodeCell', function (event, nbcell) {
                var cell = nbcell.cell;
                set_cell_state(cell, 'executed');
            });
        };
       events.on('finished_execute.CodeCell', finished_execute_event);
    });

    /**
     * Hide or show a cell
     *
     * @param cell
     * @param io 'i' for cell input, 'o' for cell output
     * @param showme {Boolean} show (true) or hide (false) cell
     */
     function showCell(cell, io, showme) {
        if ( io == 'i') {
            if ( showme == true) {
                cell.element.find("div.input").show();
                cell.metadata.hide_input = false;
            } else {
                cell.element.find("div.input").hide();
                cell.metadata.hide_input = true;
            }
        } else {
            if ( showme == true) {
                cell.element.find('div.output').show();
                cell.metadata.hide_output = false;
            } else {
                cell.element.find('div.output').hide();
                cell.metadata.hide_output = true;
            }
        }
    }

    /**
     * Hide or show input of all marked code cells
     *
     * @param show {Boolean} show (true) or hide (false) code cells
     */
    function show_input(show) {
        var ncells = Jupyter.notebook.ncells();
        var cells = Jupyter.notebook.get_cells();
        for (var i=0; i<ncells; i++) { 
            var _cell=cells[i];
            if (_cell.metadata.run_control !== undefined && _cell.metadata.run_control.marked === true )
                showCell(_cell, 'i', show);
        }
    }

    /**
     * Hide or show output area of all marked code cells
     *
     * @param {Boolean} show show (true) or hide (false)
     */
    function show_output(show) {
        var ncells = Jupyter.notebook.ncells();
        var cells = Jupyter.notebook.get_cells();
        for (var i=0; i<ncells; i++) { 
            var _cell=cells[i];
            if (_cell.metadata.run_control != undefined && _cell.metadata.run_control.marked == true )
                showCell(_cell, 'o', show);
        } 
    }


    /**
     * Execute next cell in run list, if it is still marked
     *
     */
    function execute_next_marked_cell() {
        while (run_list.length > 0) {
            var runcell = run_list.shift();
            var end = IPython.notebook.ncells();
            for (var i=0; i<end; i++) {
                if (runcell === IPython.notebook.get_cell(i)) {
                    if (runcell.metadata.run_control !== undefined && runcell.metadata.run_control.marked === true ) {
                        IPython.notebook.select(i);
                        IPython.notebook.execute_cell();
                        return;
                    }
                }
            }
        }
    }

    /**
     * Run code cells marked in metadata
     *
     */
    function run_marked_cells() {
        var current = IPython.notebook.get_selected_index();
        var end = IPython.notebook.ncells();
        run_list = [];
        /* Mark all selected cells as scheduled to be run with new gutter background color  */
        for (var i=0; i<end; i++) {
            IPython.notebook.select(i);
            var cell = IPython.notebook.get_selected_cell();
            if ((cell instanceof IPython.CodeCell)) {
                if (cell.metadata.run_control != undefined) {
                    if (cell.metadata.run_control.marked == true ) {
                        var g=cell.code_mirror.getGutterElement();
                        $(g).css({"background-color": "#00f"});
                        run_list.push(cell);
                    }
                }
            }
        }
        execute_next_marked_cell();
    }

    /*
     * Execute next cell in run_list when notified execution of last cell has been finished
     * @param evt Event
     * @param data Cell that has finished executing
     */
    var finished_execute_event = function(evt, data)
    {
        var cell = data.cell;
        /* Reset gutter color no non-queued state */
        if ((cell instanceof IPython.CodeCell)) {
            if (cell.metadata.run_control != undefined) {
                if (cell.metadata.run_control.marked == true ) {
                    var g=cell.code_mirror.getGutterElement();
                    $(g).css({"background-color": "#0f0"});
                }
            }
        }
        execute_next_marked_cell();
    }

    /**
     *
     * @param cell
     * @param value
     */
    function setCell(cell,value) {
        if (cell.metadata.run_control == undefined) cell.metadata.run_control = {};
        if (cell.metadata.run_control.marked == undefined) cell.metadata.run_control.marked = false;
        if (value == undefined) value = !cell.metadata.run_control.marked;
        var g=cell.code_mirror.getGutterElement();
        if (value == false) {
            cell.metadata.run_control.marked = false;
            $(g).css({"background-color": "#f5f5f5"});
        } else {
            cell.metadata.run_control.marked = true;
            $(g).css({"background-color": "#0f0"});
        }
    }

    /**
     * Toggle code cell marker
     */
    function toggle_marker() {
        var cell = Jupyter.notebook.get_selected_cell();
        setCell(cell, undefined);
        cell.focus_cell();
    }

    /**
     *
     */
    function mark_all() {
        var cell = Jupyter.notebook.get_selected_cell();
        var ncells = Jupyter.notebook.ncells();
        var cells = Jupyter.notebook.get_cells();
        for (var i=0; i<ncells; i++) { 
            var _cell=cells[i];
            setCell(_cell, true);
        }
        cell.focus_cell();        
    }

    /**
     *
     */
    function mark_none() {
        var cell = Jupyter.notebook.get_selected_cell();
        var ncells = Jupyter.notebook.ncells();
        var cells = Jupyter.notebook.get_cells();
        for (var i=0; i<ncells; i++) { 
            var _cell=cells[i];
            setCell(_cell, false);
        }
        cell.focus_cell();        
    }

    /**
     *
     * @param cell notebook cell instance
     * @param state {string} state to be display [ '', 'locked', 'executed', 'modified' ]
     */
    function set_cell_state(cell, state) {
        var icon = "";
        if (state === 'locked')
            { icon = '<i class="fa fa-lock" /i>' }
        else if (state === 'executed')
            { icon = '<i class="fa fa-check" aria-hidden="true"></i>' }
        else if (state === 'modified')
            { icon = '<i class="fa fa-pencil" aria-hidden="true"></i>' }

        cell.code_mirror.setGutterMarker(0,"CodeMirror-cellstate", celltypeMarker(icon))
    }

    /**
     * Change event to mark/unmark cell
     *
     * @param cm codemirror instance
     * @param line current line
     * @param gutter not used
     */
    function changeEvent(cm,line, gutter) {
        var cmline = cm.doc.children[0].lines[line];
        if (cmline === undefined) {
            var cell = Jupyter.notebook.get_selected_cell();
            set_cell_state(cell, 'modified')
            return;
        }
        /* clicking on gutterMarkers should not change selection */
        if (cmline.gutterMarkers !== null &&
            cmline.gutterMarkers.hasOwnProperty('CodeMirror-foldgutter') &&
            cmline.gutterMarkers['CodeMirror-foldgutter'] !== null) return;

        var cell = Jupyter.notebook.get_selected_cell();
        if (cell.code_mirror != cm) {
            var ncells = Jupyter.notebook.ncells();
            var cells = Jupyter.notebook.get_cells();
        for (var i=0; i<ncells; i++) {
                cell = cells[i];
                if (cell.code_mirror == cm ) { break; }
            }
        }
        if (cell.metadata.run_control == undefined)
            cell.metadata.run_control = {};
        setCell(cell, !cell.metadata.run_control.marked);
    }

    /**
     * Register newly created cell
     *
     * @param {Object} event
     * @param {Object} nbcell notebook cell
     */
    var create_cell = function (event,nbcell) {
        var cell = nbcell.cell;
        if ((cell.cell_type == "code")) {
            cell.code_mirror.on("gutterClick", changeEvent);
            if ((cell instanceof Jupyter.CodeCell)) {
                var gutters = cell.code_mirror.getOption('gutters').slice();
                if ( $.inArray("CodeMirror-cellstate", gutters) < 0) {
                        gutters.push('CodeMirror-cellstate')
                        cm.setOption('gutters', gutters);
                }
            }

        }
    };

    /**
     *
     * @param cell cell to be tested
     * @returns {boolean} true if marked
     */
    var is_marked = function(cell) {
        if (cell.metadata.run_control != undefined) {
            if (cell.metadata.run_control.marked == true) {
                return true;
            }
        }
        return false;
    };

    /**
     *  Move marked cells one up, don't have one marked cell overtake another one
     *
     */
    var move_marked_up = function() {
        var ncells = Jupyter.notebook.ncells();
        for (var i=1; i<ncells; i++) {
            var cells = Jupyter.notebook.get_cells();
            if ((cells[i].cell_type == "code")) {
                if ( is_marked(cells[i]) && !is_marked(cells[i-1]) ) {
                        
                        Jupyter.notebook.move_cell_up(i);
                }
            }
        }
    };

    /*
     * Move marked code cells one up
     *
     */
    var move_marked_down = function() {
        var ncells = Jupyter.notebook.ncells();
        for (var i=ncells-2; i>=0; i--) {
            var cells = Jupyter.notebook.get_cells();
            if ((cells[i].cell_type == "code")) {
                if (is_marked(cells[i]) && !is_marked(cells[i + 1])) {
                    Jupyter.notebook.move_cell_down(i);
                }
            }
        }
    };

    /**
     *
     * @param val
     * @returns {Element}
     */
    function celltypeMarker(val) {
        var marker = document.createElement("div");
        marker.style.color = "#822";
        marker.innerHTML = val;
        return marker;
    }

    /**
     * Lock/Unlock current code cell
     *             if (cell.metadata.run_control != undefined && cell.metadata.run_control.read_only) {
     *                     cell.code_mirror.setOption('readOnly', cell.metadata.run_control.read_only);
     */
    var lock_cell = function(locked) {
        var ncells = Jupyter.notebook.ncells();
        for (var i=ncells-2; i>=0; i--) {
            var cells = Jupyter.notebook.get_cells();
            if ((cells[i].cell_type === "code") && is_marked(cells[i])) {
                if (locked === true) {
                    cells[i].metadata.editable = false;
                    set_cell_state(cells[i], 'locked')
                } else {
                    cells[i].metadata.editable = true;
                    set_cell_state(cells[i], '')
                }
            }
        }
    };

    /**
     * Execute all cells and don't stop on errors
     *
     */
    var run_all_cells_ignore_errors = function () {
        for (var i=0; i < Jupyter.notebook.ncells(); i++) {
            Jupyter.notebook.select(i);
            var cell = Jupyter.notebook.get_selected_cell();
            cell.execute(false);
        }
    };

    /**
     * Create floating toolbar
     *
     */
    var create_runtools_div = function () {
        var btn = '<div class="btn-toolbar">\
            <div class="btn-group">\
                <button type="button" id="run_c" class="btn btn-primary fa fa-step-forward" title="Run current cell"></button>\
                <button type="button" id="run_ca" class="btn btn-primary fa icon-run-to" title="'+
                   'Run cells above (' + params["run_cells_above"] + ')"</button>\
                <button type="button" id="run_cb" class="btn btn-primary fa icon-run-from" title="' +
                    'Run cells below (' + params["run_cells_below"] + ')"</button>\
                <button type="button" id="run_a" class="btn btn-primary fa icon-run-all" title="' +
                    'Run all cells (' + params["run_all_cells"] + ')"</button>\
                <button type="button" id="run_af" class="btn btn-primary fa icon-run-all-forced" title="' +
                    'Run all - ignore errors (' + params["run_all_cells_ignore_errors"] + ')"</button>\
                <button type="button" id="run_m" class="btn btn-primary fa icon-run-marked" title="' +
                    'Run marked codecells (' + params["run_marked_cells"] + ')"</button>\
                <button type="button" id="interrupt_b" class="btn btn-primary fa fa-stop" title="' +
                    'Stop execution (' + params["stop_execution"]  + ')"</button>\
            </div>\
            <div class="btn-group">\
                <button type="button" id="mark_toggle" class="btn btn-primary fa icon-mark-toggle" title="Mark single code cell"></button>\
                <button type="button" id="mark_all" class="btn btn-primary fa icon-mark-all" title="Mark all code cells"></button>\
                <button type="button" id="mark_none" class="btn btn-primary fa icon-mark-none" title="Unmark all code cells"></button>\
            </div>\
            <div class="btn-group">\
                <button type="button" id="show_input" class="btn btn-primary fa icon-show-input" title="Show input of code cell"></button>\
                <button type="button" id="hide_input" class="btn btn-primary fa icon-hide-input" title="Hide input of code cell"></button>\
                <button type="button" id="show_output" class="btn btn-primary fa icon-show-output" title="Show output of code cell"></button>\
                <button type="button" id="hide_output" class="btn btn-primary fa icon-hide-output" title="Hide output of code cell"></button>\
            </div>\
            <div class="btn-group">\
                <button type="button" id="up_marked" class="btn btn-primary fa fa-arrow-up" title="Move marked cells down"></button>\
                <button type="button" id="down_marked" class="btn btn-primary fa fa-arrow-down" title="Move marked cells up"></button>\
                <button type="button" id="lock_marked" class="btn btn-primary fa fa-lock" title="Lock marked cells"></button>\
                <button type="button" id="unlock_marked" class="btn btn-primary fa fa-unlock" title="Unlock marked cells"></button>\
            </div>\
            </div>';

        var runtools_wrapper = $('<div id="runtools-wrapper">')
           .text("Runtools")
           .append(btn)
           .draggable()
           .append("</div>");

        $("#header").append(runtools_wrapper);
        $("#runtools-wrapper").css({'position' : 'absolute'});
        $('#run_c').on('click', function(e) { Jupyter.notebook.execute_cell(); e.target.blur() })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#run_ca').on('click', function(e) { Jupyter.notebook.execute_cells_above(); Jupyter.notebook.select_next(); e.target.blur() })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#run_cb').on('click', function(e) { Jupyter.notebook.execute_cells_below(); e.target.blur() })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#run_a').on('click', function(e) { Jupyter.notebook.execute_all_cells(); e.target.blur() })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#run_af').on('click', function(e) { run_all_cells_ignore_errors(); e.target.blur() })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#run_m').on('click', function(e) { run_marked_cells(); e.target.blur() })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#interrupt_b').on('click', function(e) { interrupt_execution(); e.target.blur() })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#mark_toggle').on('click', function() { toggle_marker()  })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#mark_all').on('click', function() { mark_all()  })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#mark_none').on('click', function() { mark_none()  })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#show_input').on('click', function() { show_input(true); this.blur() })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#hide_input').on('click', function() { show_input(false); this.blur()  })
            .tooltip({ delay: {show: 500, hide: 100}});
        $('#show_output').on('click', function() { show_output(true); this.blur()  })
            .tooltip({  delay: {show: 500, hide: 100}});
        $('#hide_output').on('click', function() { show_output(false); this.blur()  })
            .tooltip({  delay: {show: 500, hide: 100}});
        $('#up_marked').on('click', function() { move_marked_up(); this.blur()  })
            .tooltip({  delay: {show: 500, hide: 100}});
        $('#down_marked').on('click', function() { move_marked_down(); this.blur()  })
            .tooltip({  delay: {show: 500, hide: 100}});
        $('#lock_marked').on('click', function() { lock_cell(true); this.blur()  })
            .tooltip({  delay: {show: 500, hide: 100}});
        $('#unlock_marked').on('click', function() { lock_cell(false); this.blur()  })
            .tooltip({  delay: {show: 500, hide: 100}});
    };

    /**
     * Show/hide toolbar
     *
     */
    var toggle_toolbar = function() {
        var dom = $("#runtools-wrapper");

        if (dom.is(':visible')) {
            $('#toggle_runtools').removeClass('active').blur();
            dom.hide();
        } else {
            $('#toggle_runtools').addClass('active');
            dom.show();
        }

        if (dom.length === 0) {
            create_runtools_div()
        }
    };
    

    /**
     * Add CSS file
     *
     * @param name filename
     */
    var load_css = function (name) {
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl(name);
        document.getElementsByTagName("head")[0].appendChild(link);
      };


    /**
     * Add event if user clicks on codemirror gutter
     *
     */
    var ncells = Jupyter.notebook.ncells();
    var cells = Jupyter.notebook.get_cells();
    for (var i=0; i<ncells; i++) {
        var cell=cells[i];
        if ((cell.cell_type == "code")) {
            cell.code_mirror.on("gutterClick", changeEvent);

            if (cell.metadata.run_control != undefined) {
                if (cell.metadata.run_control.marked == true) {
                    var g=cell.code_mirror.getGutterElement();
                    $(g).css({"background-color": "#0f0"});
                }
            }
        }
    }


function makeCellstateMarker(cell,val,n) {
    if (cell.metadata.run_control == undefined){
        cell.metadata.run_control = {};
    }

    if (cell.metadata.run_control.state == undefined){
        cell.metadata.run_control.state = 'n';
    }

    if (val == '') { val = cell.metadata.run_control.state; };
    cell.metadata.run_control.state = val;
    n=0;

    };

    /**
     * Initialize all cells with new gutter
     */
    var initGutter = function() {
        var ncells = Jupyter.notebook.ncells();
        var cells = Jupyter.notebook.get_cells();
        for (var i=0; i<ncells; i++) {
            var cell = cells[i];
            if ((cell instanceof Jupyter.CodeCell)) {
                var gutters = cell.code_mirror.getOption('gutters').slice();
                if ($.inArray("CodeMirror-cellstate", gutters) < 0) {
                    gutters.push('CodeMirror-cellstate')
                    cell.code_mirror.setOption('gutters', gutters);
                }
                cell.code_mirror.on("change", changeEvent);
                cell.code_mirror.refresh();
            }
        }
        /**
         * Restore hide/show status after reload
         */
        for (i=0; i<ncells; i++) {
            var cell=cells[i];
            if (cell.metadata.hasOwnProperty('hide_input') && cell.metadata.hide_input === true )
                showCell(cell, 'i',false);
            if (cell.metadata.hasOwnProperty('hide_output') && cell.metadata.hide_output === true )
                showCell(cell, 'o',false);
            if (cell.is_editable() === true) {
                cell.metadata.editable = false;
                set_cell_state(cell, 'locked');
            }
        cell.code_mirror.refresh();
        }
    };

    /**
     * Called from notebook after extension was loaded
     *
     */
    var load_extension = function() {
        load_css('./main.css');
        load_css('./gutter.css'); /* change default gutter width */
        /* require our additional custom codefolding modes before initialising fully */
        require(['./cellstate'], function () {
            if (Jupyter.notebook._fully_loaded) {
                initGutter();
            }
            else {
                events.one('notebook_loaded.Notebook', initGutter);
            }
        });
        config.load()
    };

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
