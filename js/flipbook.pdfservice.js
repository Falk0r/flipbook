/* v 3.6
author http://codecanyon.net/user/creativeinteractivemedia/portfolio?ref=creativeinteractivemedia
*/

var FLIPBOOK = FLIPBOOK || {};

FLIPBOOK.PdfService = function(pdfDocument, model, options) {

    var self = this
    this.pdfDocument = pdfDocument
    this.pdfInfo = pdfDocument._pdfInfo
    this.numPages = this.pdfInfo.numPages
    this.webgl = options.viewMode == 'webgl'
    this.options = options
    this.main = options.main

    this.pages = []
    this.thumbs = []
    this.canvasBuffer = []
    this.viewports = []
    this.textContents = []

    this.pdfPages = []
    this.pdfPagesRendering = []
    this.pdfPagesRendered = []
    this.bookPagesRendered = []
    this.pdfAnnotations = []

    this.eventBus = new EventBus()

    var canvasBufferSize = options.isMobile ? 40 : 200

    for (var i = 0; i < canvasBufferSize; i++) {
        var c = document.createElement('canvas')
        c.width = 10
        c.height = 10
        c._name = i
        c.available = true
        c.pageIndex = -100
        c.pdfPageIndex = -1
        this.canvasBuffer.push(c)
    }




    this._events = {}

    this.on = function(type, fn) {
        if (!this._events[type]) {
            this._events[type] = [];
        }

        this._events[type].push(fn);
    }

    this.off = function(type, fn) {
        if (!this._events[type]) {
            return;
        }

        var index = this._events[type].indexOf(fn);

        if (index > -1) {
            this._events[type].splice(index, 1);
        }
    }

    this.trigger = function(type) {
        if (!this._events[type]) {
            return;
        }

        var i = 0,
            l = this._events[type].length;

        if (!l) {
            return;
        }

        for (; i < l; i++) {
            this._events[type][i].apply(this, [].slice.call(arguments, 1));
        }
    }




    this.getCanvas = function() {

        var i, c

        for (i = 0; i < this.canvasBuffer.length; i++) {
            c = this.canvasBuffer[i]
            if (c.available) {
                c.available = false
                c.double = false
                // c.getContext('2d').clearRect(0, 0, c.width, c.height)
                // console.log('rendering : ',c.rendering)
                break;

            }

        }

        this.canvasBuffer.splice(i, 1);
        this.canvasBuffer.push(c)
        return c

    }

    this.setRightIndex = function(ri) {

        // console.log('setRightIndex: ', ri)

        var self = this
        var unloadedPages = []
        var d = this.options.isMobile ? 4 : 20

        this.canvasBuffer.forEach(function(c) {
            c.available = ((ri - c.pageIndex) > (3 + d)) || ((ri - c.pageIndex) < (-2 - d))
            if (c.available && c.pageIndex > -1) {
                self.pdfPagesRendered[c.pdfPageIndex][c.size] = false
                delete self.pages[c.pdfPageIndex].canvas[c.size]
                self.pages[c.pdfPageIndex].rendering = false

                // if(self.pages[c.pdfPageIndex]){
                self.pages[c.pdfPageIndex].cleanup()
                // delete self.pages[c.pdfPageIndex]      
                // }

                unloadedPages.push({ index: c.pageIndex, size: c.size })
                if (c.double)
                    unloadedPages.push({ index: c.pageIndex - 1, size: c.size })
                c.pageIndex = -100
                c.getContext('2d').clearRect(0, 0, c.width, c.height)
            }
        })

        if (unloadedPages.length > 0)
            this.trigger('pageUnloaded', {unloadedPages:unloadedPages})
    }

    window.s = function() {

        var outer = document.createElement('div')

        document.body.appendChild(outer)

        self.canvasBuffer.forEach(function(c) {
            var inner = document.createElement('span')
            inner.style.margin = '2px'
            inner.style.background = '#ccc'
            inner.style.display = 'inline-block'
            outer.appendChild(inner)
            var dataurl = c.toDataURL()
            var image = new Image()
            image.src = dataurl
            image.style.border = c.available ? '1px solid #0F0' : '1px solid #F00'
            inner.appendChild(image)
            image.height = 100

            var info = document.createElement('span')
            info.style.display = 'block'
            inner.appendChild(info)
            info.innerText = c.pageIndex + ';' + c.pdfPageIndex + ";" + c.size
        })
    }

    this.loadThumbs = function(convertToBlob, callback) {

        var self = this

        this.thumbLoading = this.thumbLoading || 0

        if (this.thumbLoading >= this.pdfInfo.numPages)

            callback.call(self)

        else

            this.loadThumb(this.thumbLoading, function(c) {
                self.options.thumbLoaded(c)
                self.thumbLoading++
                    self.loadThumbs(convertToBlob, callback)
            })

    }

    this.loadThumb = function(index, callback) {

        var self = this

        // console.log('loading thumb ',index)

        this.getViewport(index, function() {

            var page = self.pages[index]

            var scale = 100 / page.getViewport(1).height

            var viewport = page.getViewport(scale);

            var c = document.createElement('canvas')
            c.index = index
            var context = c.getContext('2d');
            c.height = viewport.height;
            c.width = viewport.width;

            var renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            page.cleanupAfterRender = true
            page.render(renderContext).then(function() {

                // console.log('thumb ',index, ' loaded')
                page.cleanup()

                if (callback) callback.call(self, c)

            })

        })
    }

    this.getBookPage = function(index, size) {

    }

    this.init = function(loadOutline, backCover) {

        if(loadOutline){
            this.pdfDocument.getOutline().then(function(outline){
                self.outline = outline
                self.init()
            })
            return
        }

        self.getViewport(0, function(viewport) {

                self.r1 = viewport.width / viewport.height

                if (self.pdfInfo.numPages == 1) {
                    self.double = false
                    self.trigger("init")
                } else {
                    self.getViewport(1, function(viewport) {
                        self.r2 = viewport.width / viewport.height
                        self.double = self.r2 / self.r1 > 1.5

                        //last page index 
                        self.backCover = backCover || true
                        self.trigger("init")

                        // out - caused entire pdf to be downloaded before displaying 
                        
                        /*self.getViewport(self.pdfInfo.numPages - 1, function(viewport) {
                            self.r3 = viewport.width / viewport.height
                            self.backCover = self.r3 / self.r1 < 1.5
                            self.trigger("init")
                        })*/

                    })

                }

            })
    }

    this.startLoadingText = function(){

        this.loadingText = true

    }

    this.stopLoadingText = function(){

        this.loadingText = false
        
    }

    this.getViewport = function(index, callback) {
        if (index >= self.pdfInfo.numPages)
            return
        if (!self.pages[index]) {
            // console.log('getViewport ',index)
            pdfDocument.getPage(index + 1).then(function(page) {
                self.pages[page.pageIndex] = page
                // self.viewports[index] = page.getViewport(1);
                // callback.call(self, self.viewports[index]);

                self.getViewport(page.pageIndex, callback)
            })
        } else {
            self.viewports[index] = self.pages[index].getViewport(1);
            callback.call(self, self.viewports[index]);
        }
    }

    this.getAllViewports = function(callback) {

    }

    this.getText = function(index, callback) {
        var self = this
        this.getViewport(index, function(viewport) {
            var page = self.pages[index]

            self.getTextContent(page, function() {
                // console.log(page)
                callback.call(self, page)

            })

        })
    }

    this.getTextAllPages = function(callback) {

        var self = this

        this.loadingTextFromPage = this.loadingTextFromPage || 0

        this.getText(this.loadingTextFromPage, function() {

            if (self.loadingTextFromPage == (self.numPages - 1)){
                if (callback)
                    callback.call(self)
            } else {
                self.loadingTextFromPage++
                    self.getTextAllPages(callback)
            }

        })

    }

    this.findInPage = function(str, index, callback) {

        //console.log("find ", str, index)
        var self = this
        this.findInPageCallbacks = this.findInPageCallbacks || []
        this.findInPageCallbacks[index] = callback
        this.searchingString = str

        if(this.pages[index] && this.pages[index].textContent){
            self.findInPageTextContentAvailable(this.pages[index],index)
        }else{
            this.getText(index, function(page) {
                self.findInPageTextContentAvailable(page,index)
            })
        }

    }

    this.findInPageTextContentAvailable = function(page,index){
         //console.log("page text ready ", index)
            var arr = page.textContent.items
            var matches = 0
            for (var i = 0; i < arr.length; i++) {
                var s = arr[i].str
                if (s.includes(this.searchingString))
                    matches++
                    if (s.toUpperCase().includes(this.searchingString.toUpperCase()))
                        matches++
            }

            var callback = this.findInPageCallbacks[index]
            if(callback) 
                callback.call(this, matches, page.htmlContent)
            this.findInPageCallbacks[index] = null
    }

    this.getThumb = function(index, size, callback) {

        this.getViewport(index, function(viewport) {
            var page = self.pages[index]
            if (page.thumb)
                callback.call(self, page.thumb)
            else {
                //render thumb first
                var scale = size / self.viewports[index].height
                var viewport = page.getViewport(scale);
                var c = document.createElement('canvas')
                page.thumb = c
                var context = c.getContext('2d');
                c.height = viewport.height;
                c.width = viewport.width;

                var renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                page.cleanupAfterRender = true
                page.render(renderContext).then(function() {
                    page.cleanup()
                    callback.call(self, page.thumb)

                })

            }

        })
    }

    this.getPage = function(index, callback) {

        var self = this;
        var pdfPageIndex = self.double ? Math.round(index / 2) + 1 : index + 1
        if (pdfPageIndex > this.pdfInfo.numPages)
            return;
        // if (self.pages[pdfPageIndex])
        //     self.renderPage(self.pages[pdfPageIndex], callback)
        // else {
        pdfDocument.getPage(index).then(function(p) {
            // self.pages[index] = p
            self.renderPage(p, callback)
        });
        // }
    }

    this.renderPage = function(page, size, callback) {

        var self = this
        page.canvas = page.canvas || {}

        if (page.canvas[size]) {
            callback.call(self, page)
            return
        }

        if (page.rendering) {
            
            setTimeout(function() {
                self.renderPage(page, size, callback)
                return
            }, 300)
        }
        page.rendering = true

        //page.htmlContent = document.createElement('p')

        this.getTextContent(page, function() {

            /*ar scale = 2048 / self.viewports[1].height,
                v = page.getViewport(1),
                d = Math.max(v.width, v.height),
                scale = 2048 / d,
                viewport = page.getViewport(scale),
                canvas = document.createElement('canvas');*/

            var v = page.getViewport(1)
            //var scale = self.options.pageTextureSize / v.height
            var portrait = v.width <= v.height
            var scale = portrait || !self.webgl ? size / v.height : size / v.width
            var viewport = page.getViewport(scale)

            // var canvas = document.createElement('canvas');
            var canvas = self.getCanvas()
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.rendering = true

            if (self.webgl) {

                if (portrait) {
                    canvas.height = size;
                    canvas.width = viewport.width > size ? viewport.width : size;
                    canvas.scaleX = viewport.width / size
                    canvas.scaleY = 1
                } else {
                    canvas.width = size
                    canvas.height = viewport.height > size ? viewport.height : size
                    canvas.scaleY = viewport.height / size
                    canvas.scaleX = 1
                }
            }

            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillStyle = '#000000';

            var renderContext = {
                canvasContext: ctx,
                viewport: viewport,
                //renderInteractiveForms: false
                //textLayer: textLayer
            };

            //page.canvas[size] = canvas
            page.scale = scale
            page.canvas[size] = canvas
            page.canvas[size].ratio = viewport.width / viewport.height

            page.cleanupAfterRender = true



            var renderTask = page.render(renderContext);
            renderTask.promise.then(function() {
                renderContext = null
                if (callback)
                    callback.call(self, page)
            });

        })
    }

    this.renderPageFromPdf = function(pageIndex, size, callback) {

        var self = this

        if (pageIndex >= this.pdfInfo.numPages)
            callback.call(self)

        if (!this.pages[pageIndex]) {
            this.getViewport(pageIndex, function(viewport) {
                self.renderPageFromPdf(pageIndex, size, callback)
            });
            return
        }

        var pi = pageIndex,
            page = this.pages[pageIndex],
            v = page.getViewport(1),
            d = Math.max(v.width, v.height),
            d = v.height,
            scale = size / d

        if (self.pdfPagesRendering[pi] && self.pdfPagesRendering[pi][size]){

            setTimeout(function(){
                self.renderPageFromPdf(pageIndex, size, callback)
                }, 100)
            return

        }
            

        if (self.pdfPagesRendered[pi] && self.pdfPagesRendered[pi][size]) {

            self.onPdfPageRendered(self.pages[pi], size, callback)

        } else {

            self.pdfPagesRendered[pi] = self.pdfPagesRendered[pi] || {}

            self.pdfPagesRendering[pi] = self.pdfPagesRendering[pi] || {}

            self.pdfPagesRendering[pi][size] = true

            this.renderPage(page, size, function(page) {

                self.pdfPagesRendering[pi][size] = false
                self.pdfPagesRendered[pi][size] = true
                self.onPdfPageRendered(page, size, callback)
            })

        }
    }

    this.onBookPageRendered = function(page, canvas, index, size) {

        this.bookPagesRendered.push({ index: index, pdfPageIndex: page.pageIndex, size: size })

        //console.log("page loaded")

        this.trigger('pageLoaded', {index:index, size:size, canvas:canvas})

    }

    this.onPdfPageRendered = function(page, size, callback) {

        var self = this

        if (!page.canvas) return;
        if (!page.canvas[size]) return;

        // console.log(page.canvas)

        var c = page.canvas[size],
            h = page.htmlContent,
            pdfPageIndex = page.pageIndex;

        c.pdfPageIndex = pdfPageIndex
        c.rendering = false

        if (typeof c == 'undefined') return;

        if (options.pageMode == 'doubleWithCover') {

            if (pdfPageIndex == 0) {

                initializeHtmlContent(h, pdfPageIndex)
                c.pageIndex = 0
                c.size = size
                self.onBookPageRendered(page, c, 0, size)
                //self.options.pages[0].htmlContent = h


            } else if (pdfPageIndex == options.pages.length / 2) {

                initializeHtmlContent(h, options.numPages - 1)
                c.pageIndex = options.numPages - 1
                c.size = size
                self.onBookPageRendered(page, c, options.numPages - 1, size)
                //self.options.pages[self.options.pages.length - 1].htmlContent = h

            } else {

                h.style.transformOrigin = '0 0'

                //  if( !options.pages[2 * pdfPageIndex].canvas || !options.pages[2 * pdfPageIndex].canvas[size]){ 

                //     options.pages[2 * pdfPageIndex].canvas = options.pages[2 * pdfPageIndex].canvas || {}


                if (self.webgl) {

                    c.double = true

                    c.scaleX = (c.width / 2) / size
                    c.scaleY = c.scaleY

                    var h2 = h.cloneNode(true);

                    initializeHtmlContent(h, 2 * pdfPageIndex - 1)

                    initializeHtmlContent(h2, 2 * pdfPageIndex)

                    self.onBookPageRendered(page, c, 2 * pdfPageIndex, size)

                    self.onBookPageRendered(page, c, 2 * pdfPageIndex - 1, size)
                    c.pageIndex = 2 * pdfPageIndex
                    c.size = size

                } else {

                    var rCanvas = self.getCanvas()
                    var rcontext = rCanvas.getContext('2d');
                    rCanvas.rendering = true

                    rCanvas.width = c.width / 2;
                    rCanvas.height = c.height;

                    rcontext.fillStyle = '#FFFFFF';

                    rcontext.drawImage(c, c.width / 2, 0, c.width / 2, c.height, 0, 0, c.width / 2, c.height);
                    rCanvas.rendering = false

                    var loadedIndexR = self.options.rightToLeft ? 2 * pdfPageIndex - 1 : 2 * pdfPageIndex

                    rCanvas.pageIndex = loadedIndexR
                    rCanvas.pdfPageIndex = pdfPageIndex
                    rCanvas.size = size


                    var lCanvas = self.getCanvas()
                    var lcontext = lCanvas.getContext('2d');


                    //set dimensions
                    lCanvas.width = c.width / 2;
                    lCanvas.height = c.height;
                    lCanvas.rendering = true

                    lcontext.fillStyle = '#FFFFFF';

                    lcontext.drawImage(c, 0, 0);
                    lCanvas.rendering = false

                    var loadedIndexL = self.options.rightToLeft ? 2 * pdfPageIndex : 2 * pdfPageIndex - 1

                    lCanvas.pageIndex = loadedIndexL
                    lCanvas.pdfPageIndex = pdfPageIndex
                    lCanvas.size = size

                    var h2 = h.cloneNode(true);

                    initializeHtmlContent(h, 2 * pdfPageIndex - 1)

                    initializeHtmlContent(h2, 2 * pdfPageIndex)

                    self.onBookPageRendered(page, rCanvas, loadedIndexR, size)
                    self.onBookPageRendered(page, lCanvas, loadedIndexL, size)

                    c.available = true

                    c.getContext('2d').clearRect(0, 0, c.width, c.height)

                    c.pageIndex = -100
                    c.size = size

                }

            }

        } else {

            initializeHtmlContent(h, pdfPageIndex)
            c.pageIndex = pdfPageIndex
            c.size = size
            self.onBookPageRendered(page, c, pdfPageIndex, size)
            //self.options.pages[pdfPageIndex].htmlContent = h;

        }

        function initializeHtmlContent(h, pi) {
            /* if (options.rightToLeft)
                 pi = options.pages.length - pi - 1*/
            var page = options.pages[pi]
            if (!page.htmlContentInitialized) {
                if (page.htmlContent)
                    jQuery(h).append(jQuery(page.htmlContent))
                page.htmlContentInitialized = true
                page.htmlContent = h
            }
        }

        if (callback)
            callback.call(self, { canvas: c, size: size, pdfPageIndex: pdfPageIndex });

    }

    this.getTextContent = function(page, callback) {

        if (page.htmlContent)
            callback(page)
        else
            page.getTextContent().then(function(textContent) {
                page.textContent = textContent


                var htmlContentDiv = document.createElement('div');
                htmlContentDiv.classList.add('flipbook-page-htmlContent')

                var defaultPageHeight = 1000;

                //text layer

                if (self.options.textLayer) {

                    var textLayerDiv = document.createElement('div');
                    textLayerDiv.className = 'flipbook-textLayer';

                    var scale = 1000 / page.getViewport(1).height

                    textLayerDiv.style.width = String(1000 * page.getViewport(1).width / page.getViewport(1).height) + "px"
                    textLayerDiv.style.height = "1000px";

                    var textLayer = new TextLayerBuilder({
                        eventBus : self.eventBus,
                        textLayerDiv: textLayerDiv,
                        pageIndex: page.pageIndex,
                        viewport: page.getViewport(scale)
                    });
                    //the page. It is set to page.number - 1.
                    textLayer.setTextContent(textContent);
                    textLayer.render(TEXT_LAYER_RENDER_DELAY);
                    htmlContentDiv.appendChild(textLayerDiv)

                }

                //annotations (links) layer

                var linkService = new PDFLinkService({
                        eventBus : self.eventBus,
                    });
                
                linkService.setViewer(self.main)
                linkService.setDocument(pdfDocument)

//                 var annotationsDiv = document.createElement('div')
//                 annotationsDiv.className = 'flipbook-annotations';

//                 annotationsDiv.style.width = String(1000 * page.getViewport(1).width / page.getViewport(1).height) + "px"
//                 annotationsDiv.style.height = "1000px";
//                 annotationsDiv.style.position = 'absolute'

                var annotationLayerBuilder = new AnnotationLayerBuilder({
                    pageDiv: htmlContentDiv,
                    pdfPage: page,
                    linkService: linkService
                });

                
                annotationLayerBuilder.render(page.getViewport(1000/page.getViewport(1).height), 'display');

//                 htmlContentDiv.appendChild(annotationsDiv)
                page.htmlContent = htmlContentDiv

                callback(page)
            })
    }


    //////////////////napravi sa drawimage
    /*function cloneCanvas(c) {
        var data = c.getContext("2d").getImageData(0, 0, c.width, c.height)
        var c2 = document.createElement('canvas');
        c2.width = c.width;
        c2.height = c.height;
        var ctx2 = c2.getContext('2d');
        ctx2.putImageData(data, 0, 0);
        c.duplicate = c2
        return c2
    }*/

    this.getCanvasByHeight = function(index, height, onComplete) {

    }

    // this.getThumb = function(index, complete) {

    // }

}

FLIPBOOK.PdfService.prototype = {

    

}


var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

// var _dom_events = __webpack_require__(14);

// var _pdfjsLib = __webpack_require__(7);

// var _ui_utils = __webpack_require__(6);

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }




var EventBus = function () {
  function EventBus() {
    var _ref7 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref7$dispatchToDOM = _ref7.dispatchToDOM,
        dispatchToDOM = _ref7$dispatchToDOM === undefined ? false : _ref7$dispatchToDOM;

    _classCallCheck(this, EventBus);

    this._listeners = Object.create(null);
    this._dispatchToDOM = dispatchToDOM === true;
  }

  _createClass(EventBus, [{
    key: 'on',
    value: function on(eventName, listener) {
      var eventListeners = this._listeners[eventName];
      if (!eventListeners) {
        eventListeners = [];
        this._listeners[eventName] = eventListeners;
      }
      eventListeners.push(listener);
    }
  }, {
    key: 'off',
    value: function off(eventName, listener) {
      var eventListeners = this._listeners[eventName];
      var i = void 0;
      if (!eventListeners || (i = eventListeners.indexOf(listener)) < 0) {
        return;
      }
      eventListeners.splice(i, 1);
    }
  }, {
    key: 'dispatch',
    value: function dispatch(eventName) {
      var eventListeners = this._listeners[eventName];
      if (!eventListeners || eventListeners.length === 0) {
        if (this._dispatchToDOM) {
          var _args5 = Array.prototype.slice.call(arguments, 1);
          this._dispatchDOMEvent(eventName, _args5);
        }
        return;
      }
      var args = Array.prototype.slice.call(arguments, 1);
      eventListeners.slice(0).forEach(function (listener) {
        listener.apply(null, args);
      });
      if (this._dispatchToDOM) {
        this._dispatchDOMEvent(eventName, args);
      }
    }
  }, {
    key: '_dispatchDOMEvent',
    value: function _dispatchDOMEvent(eventName) {
      var args = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      if (!this._dispatchToDOM) {
        return;
      }
      var details = Object.create(null);
      if (args && args.length > 0) {
        var obj = args[0];
        for (var key in obj) {
          var value = obj[key];
          if (key === 'source') {
            if (value === window || value === document) {
              return;
            }
            continue;
          }
          details[key] = value;
        }
      }
      var event = document.createEvent('CustomEvent');
      event.initCustomEvent(eventName, true, true, details);
      document.dispatchEvent(event);
    }
  }]);

  return EventBus;
}();





var EXPAND_DIVS_TIMEOUT = 300;
var MATCH_SCROLL_OFFSET_TOP = -50;
var MATCH_SCROLL_OFFSET_LEFT = -400;

var TextLayerBuilder = function () {
  function TextLayerBuilder(_ref) {
    var textLayerDiv = _ref.textLayerDiv,
        eventBus = _ref.eventBus,
        pageIndex = _ref.pageIndex,
        viewport = _ref.viewport,
        _ref$findController = _ref.findController,
        findController = _ref$findController === undefined ? null : _ref$findController,
        _ref$enhanceTextSelec = _ref.enhanceTextSelection,
        enhanceTextSelection = _ref$enhanceTextSelec === undefined ? false : _ref$enhanceTextSelec;

    _classCallCheck(this, TextLayerBuilder);

    this.textLayerDiv = textLayerDiv;
    this.eventBus = eventBus || (0, _dom_events.getGlobalEventBus)();
    this.textContent = null;
    this.textContentItemsStr = [];
    this.textContentStream = null;
    this.renderingDone = false;
    this.pageIdx = pageIndex;
    this.pageNumber = this.pageIdx + 1;
    this.matches = [];
    this.viewport = viewport;
    this.textDivs = [];
    this.findController = findController;
    this.textLayerRenderTask = null;
    this.enhanceTextSelection = enhanceTextSelection;
    this._boundEvents = Object.create(null);
    this._bindEvents();
    this._bindMouse();
  }

  _createClass(TextLayerBuilder, [{
    key: '_finishRendering',
    value: function _finishRendering() {
      this.renderingDone = true;
      if (!this.enhanceTextSelection) {
        var endOfContent = document.createElement('div');
        endOfContent.className = 'endOfContent';
        this.textLayerDiv.appendChild(endOfContent);
      }
      this.eventBus.dispatch('textlayerrendered', {
        source: this,
        pageNumber: this.pageNumber,
        numTextDivs: this.textDivs.length
      });
    }
  }, {
    key: 'render',
    value: function render() {
      var _this = this;

      var timeout = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      if (!(this.textContent || this.textContentStream) || this.renderingDone) {
        return;
      }
      this.cancel();
      this.textDivs = [];
      var textLayerFrag = document.createDocumentFragment();
      this.textLayerRenderTask = (0, pdfjsLib.renderTextLayer)({
        textContent: this.textContent,
        textContentStream: this.textContentStream,
        container: textLayerFrag,
        viewport: this.viewport,
        textDivs: this.textDivs,
        textContentItemsStr: this.textContentItemsStr,
        timeout: timeout,
        enhanceTextSelection: this.enhanceTextSelection
      });
      this.textLayerRenderTask.promise.then(function () {
        _this.textLayerDiv.appendChild(textLayerFrag);
        _this._finishRendering();
        _this.updateMatches();
      }, function (reason) {});
    }
  }, {
    key: 'cancel',
    value: function cancel() {
      if (this.textLayerRenderTask) {
        this.textLayerRenderTask.cancel();
        this.textLayerRenderTask = null;
      }
    }
  }, {
    key: 'setTextContentStream',
    value: function setTextContentStream(readableStream) {
      this.cancel();
      this.textContentStream = readableStream;
    }
  }, {
    key: 'setTextContent',
    value: function setTextContent(textContent) {
      this.cancel();
      this.textContent = textContent;
    }
  }, {
    key: 'convertMatches',
    value: function convertMatches(matches, matchesLength) {
      var i = 0;
      var iIndex = 0;
      var textContentItemsStr = this.textContentItemsStr;
      var end = textContentItemsStr.length - 1;
      var queryLen = this.findController === null ? 0 : this.findController.state.query.length;
      var ret = [];
      if (!matches) {
        return ret;
      }
      for (var m = 0, len = matches.length; m < len; m++) {
        var matchIdx = matches[m];
        while (i !== end && matchIdx >= iIndex + textContentItemsStr[i].length) {
          iIndex += textContentItemsStr[i].length;
          i++;
        }
        if (i === textContentItemsStr.length) {
          console.error('Could not find a matching mapping');
        }
        var match = {
          begin: {
            divIdx: i,
            offset: matchIdx - iIndex
          }
        };
        if (matchesLength) {
          matchIdx += matchesLength[m];
        } else {
          matchIdx += queryLen;
        }
        while (i !== end && matchIdx > iIndex + textContentItemsStr[i].length) {
          iIndex += textContentItemsStr[i].length;
          i++;
        }
        match.end = {
          divIdx: i,
          offset: matchIdx - iIndex
        };
        ret.push(match);
      }
      return ret;
    }
  }, {
    key: 'renderMatches',
    value: function renderMatches(matches) {
      if (matches.length === 0) {
        return;
      }
      var textContentItemsStr = this.textContentItemsStr;
      var textDivs = this.textDivs;
      var prevEnd = null;
      var pageIdx = this.pageIdx;
      var isSelectedPage = this.findController === null ? false : pageIdx === this.findController.selected.pageIdx;
      var selectedMatchIdx = this.findController === null ? -1 : this.findController.selected.matchIdx;
      var highlightAll = this.findController === null ? false : this.findController.state.highlightAll;
      var infinity = {
        divIdx: -1,
        offset: undefined
      };
      function beginText(begin, className) {
        var divIdx = begin.divIdx;
        textDivs[divIdx].textContent = '';
        appendTextToDiv(divIdx, 0, begin.offset, className);
      }
      function appendTextToDiv(divIdx, fromOffset, toOffset, className) {
        var div = textDivs[divIdx];
        var content = textContentItemsStr[divIdx].substring(fromOffset, toOffset);
        var node = document.createTextNode(content);
        if (className) {
          var span = document.createElement('span');
          span.className = className;
          span.appendChild(node);
          div.appendChild(span);
          return;
        }
        div.appendChild(node);
      }
      var i0 = selectedMatchIdx,
          i1 = i0 + 1;
      if (highlightAll) {
        i0 = 0;
        i1 = matches.length;
      } else if (!isSelectedPage) {
        return;
      }
      for (var i = i0; i < i1; i++) {
        var match = matches[i];
        var begin = match.begin;
        var end = match.end;
        var isSelected = isSelectedPage && i === selectedMatchIdx;
        var highlightSuffix = isSelected ? ' selected' : '';
        if (this.findController) {
          if (this.findController.selected.matchIdx === i && this.findController.selected.pageIdx === pageIdx) {
            var spot = {
              top: MATCH_SCROLL_OFFSET_TOP,
              left: MATCH_SCROLL_OFFSET_LEFT
            };
            (0, _ui_utils.scrollIntoView)(textDivs[begin.divIdx], spot, true);
          }
        }
        if (!prevEnd || begin.divIdx !== prevEnd.divIdx) {
          if (prevEnd !== null) {
            appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset);
          }
          beginText(begin);
        } else {
          appendTextToDiv(prevEnd.divIdx, prevEnd.offset, begin.offset);
        }
        if (begin.divIdx === end.divIdx) {
          appendTextToDiv(begin.divIdx, begin.offset, end.offset, 'highlight' + highlightSuffix);
        } else {
          appendTextToDiv(begin.divIdx, begin.offset, infinity.offset, 'highlight begin' + highlightSuffix);
          for (var n0 = begin.divIdx + 1, n1 = end.divIdx; n0 < n1; n0++) {
            textDivs[n0].className = 'highlight middle' + highlightSuffix;
          }
          beginText(end, 'highlight end' + highlightSuffix);
        }
        prevEnd = end;
      }
      if (prevEnd) {
        appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset);
      }
    }
  }, {
    key: 'updateMatches',
    value: function updateMatches() {
      if (!this.renderingDone) {
        return;
      }
      var matches = this.matches;
      var textDivs = this.textDivs;
      var textContentItemsStr = this.textContentItemsStr;
      var clearedUntilDivIdx = -1;
      for (var i = 0, len = matches.length; i < len; i++) {
        var match = matches[i];
        var begin = Math.max(clearedUntilDivIdx, match.begin.divIdx);
        for (var n = begin, end = match.end.divIdx; n <= end; n++) {
          var div = textDivs[n];
          div.textContent = textContentItemsStr[n];
          div.className = '';
        }
        clearedUntilDivIdx = match.end.divIdx + 1;
      }
      if (!this.findController || !this.findController.highlightMatches) {
        return;
      }
      var pageMatches = void 0,
          pageMatchesLength = void 0;
      if (this.findController !== null) {
        pageMatches = this.findController.pageMatches[this.pageIdx] || null;
        pageMatchesLength = this.findController.pageMatchesLength ? this.findController.pageMatchesLength[this.pageIdx] || null : null;
      }
      this.matches = this.convertMatches(pageMatches, pageMatchesLength);
      this.renderMatches(this.matches);
    }
  }, {
    key: '_bindEvents',
    value: function _bindEvents() {
      var _this2 = this;

      var eventBus = this.eventBus,
          _boundEvents = this._boundEvents;

      _boundEvents.pageCancelled = function (evt) {
        if (evt.pageNumber !== _this2.pageNumber) {
          return;
        }
        if (_this2.textLayerRenderTask) {
          console.error('TextLayerBuilder._bindEvents: `this.cancel()` should ' + 'have been called when the page was reset, or rendering cancelled.');
          return;
        }
        for (var name in _boundEvents) {
          eventBus.off(name.toLowerCase(), _boundEvents[name]);
          delete _boundEvents[name];
        }
      };
      _boundEvents.updateTextLayerMatches = function (evt) {
        if (evt.pageIndex !== _this2.pageIdx && evt.pageIndex !== -1) {
          return;
        }
        _this2.updateMatches();
      };
      eventBus.on('pagecancelled', _boundEvents.pageCancelled);
      eventBus.on('updatetextlayermatches', _boundEvents.updateTextLayerMatches);
    }
  }, {
    key: '_bindMouse',
    value: function _bindMouse() {
      var _this3 = this;

      var div = this.textLayerDiv;
      var expandDivsTimer = null;
      div.addEventListener('mousedown', function (evt) {
        if (_this3.enhanceTextSelection && _this3.textLayerRenderTask) {
          _this3.textLayerRenderTask.expandTextDivs(true);
          if (expandDivsTimer) {
            clearTimeout(expandDivsTimer);
            expandDivsTimer = null;
          }
          return;
        }
        var end = div.querySelector('.endOfContent');
        if (!end) {
          return;
        }
        var adjustTop = evt.target !== div;
        adjustTop = adjustTop && window.getComputedStyle(end).getPropertyValue('-moz-user-select') !== 'none';
        if (adjustTop) {
          var divBounds = div.getBoundingClientRect();
          var r = Math.max(0, (evt.pageY - divBounds.top) / divBounds.height);
          end.style.top = (r * 100).toFixed(2) + '%';
        }
        end.classList.add('active');
      });
      div.addEventListener('mouseup', function () {
        if (_this3.enhanceTextSelection && _this3.textLayerRenderTask) {
          expandDivsTimer = setTimeout(function () {
            if (_this3.textLayerRenderTask) {
              _this3.textLayerRenderTask.expandTextDivs(false);
            }
            expandDivsTimer = null;
          }, EXPAND_DIVS_TIMEOUT);
          return;
        }
        var end = div.querySelector('.endOfContent');
        if (!end) {
          return;
        }
        end.style.top = '';
        end.classList.remove('active');
      });
    }
  }]);

  return TextLayerBuilder;
}();

var DefaultTextLayerFactory = function () {
  function DefaultTextLayerFactory() {
    _classCallCheck(this, DefaultTextLayerFactory);
  }

  _createClass(DefaultTextLayerFactory, [{
    key: 'createTextLayerBuilder',
    value: function createTextLayerBuilder(textLayerDiv, pageIndex, viewport) {
      var enhanceTextSelection = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

      return new TextLayerBuilder({
        textLayerDiv: textLayerDiv,
        pageIndex: pageIndex,
        viewport: viewport,
        enhanceTextSelection: enhanceTextSelection
      });
    }
  }]);

  return DefaultTextLayerFactory;
}();


var PDFLinkService = function () {
  function PDFLinkService() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        eventBus = _ref.eventBus,
        _ref$externalLinkTarg = _ref.externalLinkTarget,
        externalLinkTarget = _ref$externalLinkTarg === undefined ? null : _ref$externalLinkTarg,
        _ref$externalLinkRel = _ref.externalLinkRel,
        externalLinkRel = _ref$externalLinkRel === undefined ? null : _ref$externalLinkRel;

    _classCallCheck(this, PDFLinkService);

    this.eventBus = eventBus || (0, _dom_events.getGlobalEventBus)();
    this.externalLinkTarget = externalLinkTarget;
    this.externalLinkRel = externalLinkRel;
    this.baseUrl = null;
    this.pdfDocument = null;
    this.pdfViewer = null;
    this.pdfHistory = null;
    this._pagesRefCache = null;
  }

  _createClass(PDFLinkService, [{
    key: 'setDocument',
    value: function setDocument(pdfDocument) {
      var baseUrl = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      this.baseUrl = baseUrl;
      this.pdfDocument = pdfDocument;
      this._pagesRefCache = Object.create(null);
    }
  }, {
    key: 'setViewer',
    value: function setViewer(pdfViewer) {
      this.pdfViewer = pdfViewer;
    }
  }, {
    key: 'setHistory',
    value: function setHistory(pdfHistory) {
      this.pdfHistory = pdfHistory;
    }
  }, {
    key: 'navigateTo',
    value: function navigateTo(dest) {
      var _this = this;

      var goToDestination = function goToDestination(_ref2) {
        var namedDest = _ref2.namedDest,
            explicitDest = _ref2.explicitDest;

        var destRef = explicitDest[0],
            pageNumber = void 0;
        if (destRef instanceof Object) {
          pageNumber = _this._cachedPageNumber(destRef);
          if (pageNumber === null) {
            _this.pdfDocument.getPageIndex(destRef).then(function (pageIndex) {
              _this.cachePageRef(pageIndex + 1, destRef);
              goToDestination({
                namedDest: namedDest,
                explicitDest: explicitDest
              });
            }).catch(function () {
              console.error('PDFLinkService.navigateTo: "' + destRef + '" is not ' + ('a valid page reference, for dest="' + dest + '".'));
            });
            return;
          }
        } else if (Number.isInteger(destRef)) {
          pageNumber = destRef + 1;
        } else {
          console.error('PDFLinkService.navigateTo: "' + destRef + '" is not ' + ('a valid destination reference, for dest="' + dest + '".'));
          return;
        }
        if (!pageNumber || pageNumber < 1 || pageNumber > _this.pagesCount) {
          console.error('PDFLinkService.navigateTo: "' + pageNumber + '" is not ' + ('a valid page number, for dest="' + dest + '".'));
          return;
        }
        if (_this.pdfHistory) {
          _this.pdfHistory.pushCurrentPosition();
          _this.pdfHistory.push({
            namedDest: namedDest,
            explicitDest: explicitDest,
            pageNumber: pageNumber
          });
        }
        _this.pdfViewer.scrollPageIntoView({
          pageNumber: pageNumber,
          destArray: explicitDest
        });
      };
      new Promise(function (resolve, reject) {
        if (typeof dest === 'string') {
          _this.pdfDocument.getDestination(dest).then(function (destArray) {
            resolve({
              namedDest: dest,
              explicitDest: destArray
            });
          });
          return;
        }
        resolve({
          namedDest: '',
          explicitDest: dest
        });
      }).then(function (data) {
        if (!Array.isArray(data.explicitDest)) {
          console.error('PDFLinkService.navigateTo: "' + data.explicitDest + '" is' + (' not a valid destination array, for dest="' + dest + '".'));
          return;
        }
        goToDestination(data);
      });
    }
  }, {
    key: 'getDestinationHash',
    value: function getDestinationHash(dest) {
      if (typeof dest === 'string') {
        return this.getAnchorUrl('#' + escape(dest));
      }
      if (Array.isArray(dest)) {
        var str = JSON.stringify(dest);
        return this.getAnchorUrl('#' + escape(str));
      }
      return this.getAnchorUrl('');
    }
  }, {
    key: 'getAnchorUrl',
    value: function getAnchorUrl(anchor) {
      return (this.baseUrl || '') + anchor;
    }
  }, {
    key: 'setHash',
    value: function setHash(hash) {
      var pageNumber = void 0,
          dest = void 0;
      if (hash.includes('=')) {
        var params = (0, _ui_utils.parseQueryString)(hash);
        if ('search' in params) {
          this.eventBus.dispatch('findfromurlhash', {
            source: this,
            query: params['search'].replace(/"/g, ''),
            phraseSearch: params['phrase'] === 'true'
          });
        }
        if ('nameddest' in params) {
          this.navigateTo(params.nameddest);
          return;
        }
        if ('page' in params) {
          pageNumber = params.page | 0 || 1;
        }
        if ('zoom' in params) {
          var zoomArgs = params.zoom.split(',');
          var zoomArg = zoomArgs[0];
          var zoomArgNumber = parseFloat(zoomArg);
          if (!zoomArg.includes('Fit')) {
            dest = [null, { name: 'XYZ' }, zoomArgs.length > 1 ? zoomArgs[1] | 0 : null, zoomArgs.length > 2 ? zoomArgs[2] | 0 : null, zoomArgNumber ? zoomArgNumber / 100 : zoomArg];
          } else {
            if (zoomArg === 'Fit' || zoomArg === 'FitB') {
              dest = [null, { name: zoomArg }];
            } else if (zoomArg === 'FitH' || zoomArg === 'FitBH' || zoomArg === 'FitV' || zoomArg === 'FitBV') {
              dest = [null, { name: zoomArg }, zoomArgs.length > 1 ? zoomArgs[1] | 0 : null];
            } else if (zoomArg === 'FitR') {
              if (zoomArgs.length !== 5) {
                console.error('PDFLinkService.setHash: Not enough parameters for "FitR".');
              } else {
                dest = [null, { name: zoomArg }, zoomArgs[1] | 0, zoomArgs[2] | 0, zoomArgs[3] | 0, zoomArgs[4] | 0];
              }
            } else {
              console.error('PDFLinkService.setHash: "' + zoomArg + '" is not ' + 'a valid zoom value.');
            }
          }
        }
        if (dest) {
          this.pdfViewer.scrollPageIntoView({
            pageNumber: pageNumber || this.page,
            destArray: dest,
            allowNegativeOffset: true
          });
        } else if (pageNumber) {
          this.page = pageNumber;
        }
        if ('pagemode' in params) {
          this.eventBus.dispatch('pagemode', {
            source: this,
            mode: params.pagemode
          });
        }
      } else {
        dest = unescape(hash);
        try {
          dest = JSON.parse(dest);
          if (!Array.isArray(dest)) {
            dest = dest.toString();
          }
        } catch (ex) {}
        if (typeof dest === 'string' || isValidExplicitDestination(dest)) {
          this.navigateTo(dest);
          return;
        }
        console.error('PDFLinkService.setHash: "' + unescape(hash) + '" is not ' + 'a valid destination.');
      }
    }
  }, {
    key: 'executeNamedAction',
    value: function executeNamedAction(action) {
      switch (action) {
        case 'GoBack':
          if (this.pdfHistory) {
            this.pdfHistory.back();
          }
          break;
        case 'GoForward':
          if (this.pdfHistory) {
            this.pdfHistory.forward();
          }
          break;
        case 'NextPage':
          if (this.page < this.pagesCount) {
            this.page++;
          }
          break;
        case 'PrevPage':
          if (this.page > 1) {
            this.page--;
          }
          break;
        case 'LastPage':
          this.page = this.pagesCount;
          break;
        case 'FirstPage':
          this.page = 1;
          break;
        default:
          break;
      }
      this.eventBus.dispatch('namedaction', {
        source: this,
        action: action
      });
    }
  }, {
    key: 'cachePageRef',
    value: function cachePageRef(pageNum, pageRef) {
      if (!pageRef) {
        return;
      }
      var refStr = pageRef.num + ' ' + pageRef.gen + ' R';
      this._pagesRefCache[refStr] = pageNum;
    }
  }, {
    key: '_cachedPageNumber',
    value: function _cachedPageNumber(pageRef) {
      var refStr = pageRef.num + ' ' + pageRef.gen + ' R';
      return this._pagesRefCache && this._pagesRefCache[refStr] || null;
    }
  }, {
    key: 'pagesCount',
    get: function get() {
      return this.pdfDocument ? this.pdfDocument.numPages : 0;
    }
  }, {
    key: 'page',
    get: function get() {
      return this.pdfViewer.currentPageNumber;
    },
    set: function set(value) {
      this.pdfViewer.currentPageNumber = value;
    }
  }, {
    key: 'rotation',
    get: function get() {
      return this.pdfViewer.pagesRotation;
    },
    set: function set(value) {
      this.pdfViewer.pagesRotation = value;
    }
  }]);

  return PDFLinkService;
}();

function isValidExplicitDestination(dest) {
  if (!Array.isArray(dest)) {
    return false;
  }
  var destLength = dest.length,
      allowNull = true;
  if (destLength < 2) {
    return false;
  }
  var page = dest[0];
  if (!((typeof page === 'undefined' ? 'undefined' : _typeof(page)) === 'object' && Number.isInteger(page.num) && Number.isInteger(page.gen)) && !(Number.isInteger(page) && page >= 0)) {
    return false;
  }
  var zoom = dest[1];
  if (!((typeof zoom === 'undefined' ? 'undefined' : _typeof(zoom)) === 'object' && typeof zoom.name === 'string')) {
    return false;
  }
  switch (zoom.name) {
    case 'XYZ':
      if (destLength !== 5) {
        return false;
      }
      break;
    case 'Fit':
    case 'FitB':
      return destLength === 2;
    case 'FitH':
    case 'FitBH':
    case 'FitV':
    case 'FitBV':
      if (destLength !== 3) {
        return false;
      }
      break;
    case 'FitR':
      if (destLength !== 6) {
        return false;
      }
      allowNull = false;
      break;
    default:
      return false;
  }
  for (var i = 2; i < destLength; i++) {
    var param = dest[i];
    if (!(typeof param === 'number' || allowNull && param === null)) {
      return false;
    }
  }
  return true;
}

var SimpleLinkService = function () {
  function SimpleLinkService() {
    _classCallCheck(this, SimpleLinkService);

    this.externalLinkTarget = null;
    this.externalLinkRel = null;
  }

  _createClass(SimpleLinkService, [{
    key: 'navigateTo',
    value: function navigateTo(dest) {}
  }, {
    key: 'getDestinationHash',
    value: function getDestinationHash(dest) {
      return '#';
    }
  }, {
    key: 'getAnchorUrl',
    value: function getAnchorUrl(hash) {
      return '#';
    }
  }, {
    key: 'setHash',
    value: function setHash(hash) {}
  }, {
    key: 'executeNamedAction',
    value: function executeNamedAction(action) {}
  }, {
    key: 'cachePageRef',
    value: function cachePageRef(pageNum, pageRef) {}
  }, {
    key: 'pagesCount',
    get: function get() {
      return 0;
    }
  }, {
    key: 'page',
    get: function get() {
      return 0;
    },
    set: function set(value) {}
  }, {
    key: 'rotation',
    get: function get() {
      return 0;
    },
    set: function set(value) {}
  }]);

  return SimpleLinkService;
}();


var AnnotationLayerBuilder = function () {
  function AnnotationLayerBuilder(_ref) {
    var pageDiv = _ref.pageDiv,
        pdfPage = _ref.pdfPage,
        linkService = _ref.linkService,
        downloadManager = _ref.downloadManager,
        _ref$imageResourcesPa = _ref.imageResourcesPath,
        imageResourcesPath = _ref$imageResourcesPa === undefined ? '' : _ref$imageResourcesPa,
        _ref$renderInteractiv = _ref.renderInteractiveForms,
        renderInteractiveForms = _ref$renderInteractiv === undefined ? false : _ref$renderInteractiv;
        // _ref$l10n = _ref.l10n,
        // l10n = _ref$l10n === undefined ? _ui_utils.NullL10n : _ref$l10n;

    _classCallCheck(this, AnnotationLayerBuilder);

    this.pageDiv = pageDiv;
    this.pdfPage = pdfPage;
    this.linkService = linkService;
    this.downloadManager = downloadManager;
    this.imageResourcesPath = imageResourcesPath;
    this.renderInteractiveForms = renderInteractiveForms;
    // this.l10n = l10n;
    this.div = null;
    this._cancelled = false;
  }

  _createClass(AnnotationLayerBuilder, [{
    key: 'render',
    value: function render(viewport) {
      var _this = this;

      var intent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'display';

      this.pdfPage.getAnnotations({ intent: intent }).then(function (annotations) {
        if (_this._cancelled) {
          return;
        }
        var parameters = {
          viewport: viewport.clone({ dontFlip: true }),
          div: _this.div,
          annotations: annotations,
          page: _this.pdfPage,
          imageResourcesPath: _this.imageResourcesPath,
          renderInteractiveForms: _this.renderInteractiveForms,
          linkService: _this.linkService,
          downloadManager: _this.downloadManager
        };
        if (_this.div) {
          pdfjsLib.AnnotationLayer.update(parameters);
        } else {
          if (annotations.length === 0) {
            return;
          }
          _this.div = document.createElement('div');
          _this.div.className = 'annotationLayer';
          _this.pageDiv.appendChild(_this.div);
          parameters.div = _this.div;
          pdfjsLib.AnnotationLayer.render(parameters);
          // _this.l10n.translate(_this.div);
        }
      });
    }
  }, {
    key: 'cancel',
    value: function cancel() {
      this._cancelled = true;
    }
  }, {
    key: 'hide',
    value: function hide() {
      if (!this.div) {
        return;
      }
      this.div.setAttribute('hidden', 'true');
    }
  }]);

  return AnnotationLayerBuilder;
}();

var DefaultAnnotationLayerFactory = function () {
  function DefaultAnnotationLayerFactory() {
    _classCallCheck(this, DefaultAnnotationLayerFactory);
  }

  _createClass(DefaultAnnotationLayerFactory, [{
    key: 'createAnnotationLayerBuilder',
    value: function createAnnotationLayerBuilder(pageDiv, pdfPage) {
      var imageResourcesPath = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
      var renderInteractiveForms = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
      // var l10n = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : _ui_utils.NullL10n;

      return new AnnotationLayerBuilder({
        pageDiv: pageDiv,
        pdfPage: pdfPage,
        imageResourcesPath: imageResourcesPath,
        renderInteractiveForms: renderInteractiveForms,
        linkService: new SimpleLinkService(),
        // l10n: l10n
      });
    }
  }]);

  return DefaultAnnotationLayerFactory;
}();





var TEXT_LAYER_RENDER_DELAY = 200; // ms

var MAX_TEXT_DIVS_TO_RENDER = 100000;

var NonWhitespaceRegexp = /\S/;






