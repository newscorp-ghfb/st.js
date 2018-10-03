(function() {
  var path = require('path');
  var config = {};
  var $context = this;
  var root; // root context
  var Initialization = function(_config) {
    if (typeof _config === 'object') {
      config = _config;
    }
    return this;
  };
  var loadedModules = {}
  var Helper = {
    dottedStringToArray: function(string) {
      return Array.isArray(string) ? string : string.split(/[\s.]+/).filter(p => p !== '');
    },
    get: function(object, properties, defaultValue) {
      if (!Helper.is_object(object)&&!Helper.is_array(object)&&!Helper.is_string(object)) return defaultValue;

      const props = Helper.dottedStringToArray(properties);

      return props.length === 0
        ? defaultValue
        : Helper.baseGet(object, props, defaultValue, props.length);
    },
    baseGet: function(object, properties, defaultValue, propertyCount) {
      if (object === null || object === undefined) return defaultValue;

      const currentIndex = properties.length - propertyCount;
      const property = properties[currentIndex];
      // eslint-disable-next-line no-prototype-builtins
      const hasProperty = object.hasOwnProperty(property);
      const value = hasProperty ? object[property] : defaultValue;

      return !hasProperty || propertyCount <= 1
        ? value
        : Helper.baseGet(object[property], properties, defaultValue, propertyCount - 1);
    },
    is_template: function(str) {
      var re = /\{\{(.+)\}\}/g;
      return re.test(str);
    },
    is_array: function(item) {
      return (
        Array.isArray(item) ||
        (!!item &&
          typeof item === 'object' && typeof item.length === 'number' &&
          (item.length === 0 || (item.length > 0 && (item.length - 1) in item))
        )
      );
    },
    is_object: function(item){
      return item && typeof item === 'object'
    },
    is_string: function(str){
      return typeof arrayOrString === 'string';
    },
    resolve: function(o, path, new_val) {
      // 1. Takes any object
      // 2. Finds subtree based on path
      // 3. Sets the value to new_val
      // 4. Returns the object;
      if (path && path.length > 0) {
        var func = Function('new_val', 'with(this) {this' + path + '=new_val; return this;}').bind(o);
        return func(new_val);
      } else {
        o = new_val;
        return o;
      }
    },
    load_file: function(defaultRootPath, filePath) {
      if(loadedModules[defaultRootPath+filePath]){
        return loadedModules[defaultRootPath+filePath]
      }
      let actualPath = filePath;

      let loadedFile;
      try {
        loadedFile = require(actualPath);
      } catch (e1) {
        try {
          actualPath = `./${filePath}`;
          loadedFile = require(actualPath);
        } catch (e2) {
          actualPath = path.join(defaultRootPath, filePath);
          loadedFile = require(actualPath);
        }
      }
      console.log(`Loading file ${actualPath}...`);
      loadedModules[defaultRootPath+filePath] = loadedFile
      return loadedFile;
    },
  };
  var Conditional = {
    run: function(template, data) {
      // expecting template as an array of objects,
      // each of which contains '#if', '#elseif', 'else' as key

      // item should be in the format of:
      // {'#if item': 'blahblah'}

      // Step 1. get all the conditional keys of the template first.
      // Step 2. then try evaluating one by one until something returns true
      // Step 3. if it reaches the end, the last item shall be returned
      for (var i = 0; i < template.length; i++) {
        var item = template[i];
        var keys = Object.keys(item);
        // assuming that there's only a single kv pair for each item
        var key = keys[0];
        var func = TRANSFORM.tokenize(key);
        if (func.name === '#if' || func.name === '#elseif') {
          var expression = func.expression;
          var res = TRANSFORM.fillout(data, '{{' + expression + '}}');
          if (res === ('{{' + expression + '}}')) {
            // if there was at least one item that was not evaluatable,
            // we halt parsing and return the template;
            return template;
          } else {
            if (res) {
              // run the current one and return
              return TRANSFORM.run(item[key], data);
            } else {
              // res was falsy. Ignore this branch and go on to the next item
            }
          }
        } else {
          // #else
          // if you reached this point, it means:
          //  1. there were no non-evaluatable expressions
          //  2. Yet all preceding expressions evaluated to falsy value
          //  Therefore we run this branch
          return TRANSFORM.run(item[key], data);
        }
      }
      // if you've reached this point, it means nothing matched.
      // so return null
      return null;
    },
    is: function(template) {
      // TRUE ONLY IF it's in a correct format.
      // Otherwise return the original template
      // Condition 0. Must be an array
      // Condition 1. Must have at least one item
      // Condition 2. Each item in the array should be an object of a single key/value pair
      // Condition 3. starts with #if
      // Condition 4. in case there's more than two items, everything between the first and the last item should be #elseif
      // Condition 5. in case there's more than two items, the last one should be either '#else' or '#elseif'
      if (!Helper.is_array(template)) {
        // Condition 0, it needs to be an array to be a conditional
        return false;
      }
      // Condition 1.
      // Must have at least one item
      if (template.length === 0) {
        return false;
      }
      // Condition 2.
      // Each item in the array should be an object
      // , and  of a single key/value pair
      var containsValidObjects = true;
      for (var i = 0; i < template.length; i++) {
        var item = template[0];
        if (typeof item !== 'object') {
          containsValidObjects = false;
          break;
        }
        if (Object.keys(item).length !== 1) {
          // first item in the array has multiple key value pairs, so invalid.
          containsValidObjects = false;
          break;
        }
      }
      if (!containsValidObjects) {
        return false;
      }
      // Condition 3.
      // the first item should have #if as its key
      // the first item should also contain an expression
      var first = template[0];
      var func;
      for (var key in first) {
        func = TRANSFORM.tokenize(key);
        if (!func) {
          return false;
        }
        if (!func.name) {
          return false;
        }
        // '{{#if }}'
        if (!func.expression || func.expression.length === 0) {
          return false;
        }
        if (func.name.toLowerCase() !== '#if') {
          return false;
        }
      }
      if (template.length === 1) {
        // If we got this far and the template has only one item, it means
        // template had one item which was '#if' so it's valid
        return true;
      }
      // Condition 4.
      // in case there's more than two items, everything between the first and the last item should be #elseif
      var they_are_all_elseifs = true;
      for (var template_index = 1; template_index < template.length-1; template_index++) {
        var template_item = template[template_index];
        for (var template_key in template_item) {
          func = TRANSFORM.tokenize(template_key);
          if (func.name.toLowerCase() !== '#elseif') {
            they_are_all_elseifs = false;
            break;
          }
        }
      }
      if (!they_are_all_elseifs) {
        // There was at least one item that wasn't an elseif
        // therefore invalid
        return false;
      }
      // If you've reached this point, it means we have multiple items and everything between the first and the last item
      // are elseifs
      // Now we need to check the validity of the last item
      // Condition 5.
      // in case there's more than one item, it should end with #else or #elseif
      var last = template[template.length-1];
      for (var last_key in last) {
        func = TRANSFORM.tokenize(last_key);
        if (['#else', '#elseif'].indexOf(func.name.toLowerCase()) === -1) {
          return false;
        }
      }
      // Congrats, if you've reached this point, it's valid
      return true;
    },
  };
  var TRANSFORM = {
    memory: {},
    transform: function(template, data) {
      if(typeof template === 'string'){
        if (!Helper.is_template(template)){
          return template
        }
        var include_string_re = /\{\{([ ]*#include)[ ]*([^ ]*)\}\}/g;
        if (include_string_re.test(template)) {
          var fun = TRANSFORM.tokenize(template);
          if (fun.expression) {
            // if #include has arguments, evaluate it before attaching
            return TRANSFORM.fillout(data, '{{' + fun.expression + '}}', true);
          } else {
              // shouldn't happen =>
              // {'wrapper': '{{#include}}'}
              return template;
            }
        }
        return TRANSFORM.fillout(data, template);
      }
      else if (Helper.is_array(template)) {
        if (Conditional.is(template)) {
          return Conditional.run(template, data);//TODO rewrite this too
        } else {
          return template.map(t => TRANSFORM.transform(t, data)).filter(i => !!i)
        }
      }
      else if (Object.prototype.toString.call(template) === '[object Object]') {
        // template is an object
        return Object.keys(template).map(key =>{
          if (typeof template[key] === 'string') {
            const fun = TRANSFORM.tokenize(template[key]);
            if (fun && fun.name === '#?') {
              // If the key is a template expression but aren't either #include or #each,
              // it needs to be parsed
              const filled = TRANSFORM.fillout(data, '{{' + fun.expression + '}}');
              if (filled === '{{' + fun.expression + '}}' || !filled) {
                // case 1.
                // not parsed, which means the evaluation failed.

                // case 2.
                // returns fasly value

                // both cases mean this key should be excluded
                return null
              }
              return filled;
            }
          }
          const nextKeys = Object.keys(template[key])
          if(Helper.is_object(template[key]) && nextKeys.length==1){
            const fun = TRANSFORM.tokenize(nextKeys[0]);
            const funTemplate = template[key][nextKeys[0]]
            if(fun){
              if(fun.name === '#include'){
                return TRANSFORM.fillout(funTemplate,'{{' + fun.expression + '}}', true)
              }
              else if(fun.name === '#template'){
                if(Helper.is_object(template[key])){
                  return TRANSFORM.parseTemplate(data, funTemplate)
                }
                else{
                  return funTemplate
                }
              }
              else if (fun.name === '#concat') {
                if (Helper.is_array(funTemplate)) {
                  return funTemplate.reduce((list, concat_item) => {
                    return list.concat(TRANSFORM.transform(concat_item, data))
                  }, [])
                }
                else{
                  return funTemplate
                }
              }
              else if (fun.name === '#merge') {
                if (Helper.is_array(funTemplate)) {
                  return funTemplate.reduce((obj, merge) => {
                    return Object.assign(obj,TRANSFORM.transform(merge))
                  }, {})
                }else{
                  return funTemplate
                }
              }
              else if (fun.name == '#each'){
                var newData = TRANSFORM.fillout(data, '{{' + fun.expression + '}}', true);
                if (newData && Helper.is_array(newData)) {
                  return newData.map( n => {
                    return TRANSFORM.transform(funTemplate, n)
                  })
                }
                else{
                  return funTemplate
                }
              }
            }
          }//end handle potential functions. 
          return TRANSFORM.transform(template[key], data);
        }).filter(item=>!!item)
      }
      return template//not a string nor array nor object. just return the template
    },
    tokenize: function(str) {
      // INPUT : string
      // OUTPUT : {name: FUNCTION_NAME:STRING, args: ARGUMENT:ARRAY}
      var re = /\{\{(.+)\}\}/g;
      str = str.replace(re, '$1');
      // str : '#each $jason.items'

      var tokens = str.trim().split(' ');
      // => tokens: ['#each', '$jason.items']

      var func;
      if (tokens.length > 0) {
        if (tokens[0][0] === '#') {
          func = tokens.shift();
          // => func: '#each' or '#if'
          // => tokens: ['$jason.items', '&&', '$jason.items.length', '>', '0']

          var expression = tokens.join(' ');
          // => expression: '$jason.items && $jason.items.length > 0'

          return { name: func, expression: expression };
        }
      }
      return null;
    },
    parseTemplate: function(data, args){
      const templatesFolder = config.templatesFolder || './';
      const formattersFolder = config.formattersFolder || './';
      const {template, formatter, inputProperty, constantData} = args
      data = Object.assign({},inputProperty ? Helper.get(data, inputProperty) : data, constantData)
      try {
        const newTemplate = Helper.load_file(templatesFolder, template);
        const formatterFunction = formatter
          ? Helper.load_file(formattersFolder, formatter)
          : (x,y) => x;
        const formattedData = formatterFunction(data);
        return TRANSFORM.transform(newTemplate, formattedData);
      } catch(err) {
        console.error(err)
        return "";
      }
    },
    fillout: function(data, template, raw) {
      // 1. fill out if possible
      // 2. otherwise return the original
      var replaced = template;
      // Run fillout() only if it's a template. Otherwise just return the original string
      
      if (Helper.is_template(template)){
        var re = /\{\{(.*?)\}\}/g;
        // variables are all instances of {{ }} in the current expression
        // for example '{{this.item}} is {{this.user}}'s' has two variables: ['this.item', 'this.user']
        var variables = template.match(re);

        if (variables) {
          if (raw) {
            // 'raw' is true only for when this is called from #each
            // Because #each is expecting an array, it shouldn't be stringified.
            // Therefore we pass template:null,
            // which will result in returning the original result instead of trying to
            // replace it into the template with a stringified version
            replaced = TRANSFORM._fillout({
              variable: variables[0],
              data: data,
              template: null,
            });
          } else {
            // Fill out the template for each variable
            for (var i = 0; i < variables.length; i++) {
              var variable = variables[i];
              replaced = TRANSFORM._fillout({
                variable: variable,
                data: data,
                template: replaced,
              });
            }
          }
        } else {
          return replaced;
        }
      }
      return replaced;
    },
    _fillout: function(options) {
      // Given a template and fill it out with passed slot and its corresponding data
      var re = /\{\{(.*?)\}\}/g;
      var full_re = /^\{\{((?!\}\}).)*\}\}$/;
      var variable = options.variable;
      var data = options.data;
      var template = options.template;
      try {
        // 1. Evaluate the variable
        var slot = variable.replace(re, '$1');

        // data must exist. Otherwise replace with blank
        if (data) {
          var func;
          // Attach $root to each node so that we can reference it from anywhere
          var data_type = typeof data;
          if (['number', 'string', 'array', 'boolean', 'function'].indexOf(data_type === -1)) {
            data.$root = root;
          }
          // If the pattern ends with a return statement, but is NOT wrapped inside another function ([^}]*$), it's a function expression
          var match = /function\([ ]*\)[ ]*\{(.*)\}[ ]*$/g.exec(slot);
          if (match) {
            func = Function('with(this) {' + match[1] + '}').bind(data);
          } else if (/\breturn [^;]+;?[ ]*$/.test(slot) && /return[^}]*$/.test(slot)) {
            // Function expression with explicit 'return' expression
            func = Function('with(this) {' + slot + '}').bind(data);
          } else {
            // Function expression with explicit 'return' expression
            // Ordinary simple expression that
            func = Function('with(this) {return (' + slot + ')}').bind(data);
          }
          var evaluated = func();
          delete data.$root;  // remove $root now that the parsing is over
          if (evaluated) {
            // In case of primitive types such as String, need to call valueOf() to get the actual value instead of the promoted object
            evaluated = evaluated.valueOf();
          }
          if (typeof evaluated === 'undefined') {
            // it tried to evaluate since the variable existed, but ended up evaluating to undefined
            // (example: var a = [1,2,3,4]; var b = a[5];)
            return template;
          } else {
            // 2. Fill out the template with the evaluated value
            // Be forgiving and print any type, even functions, so it's easier to debug
            if (evaluated) {
              // IDEAL CASE : Return the replaced template
              if (template) {
                // if the template is a pure template with no additional static text,
                // And if the evaluated value is an object or an array, we return the object itself instead of
                // replacing it into template via string replace, since that will turn it into a string.
                if (full_re.test(template)) {
                  return evaluated;
                } else {
                  return template.replace(variable, evaluated);
                }
              } else {
                return evaluated;
              }
            } else {
              // Treat false or null as blanks (so that #if can handle it)
              if (template) {
                // if the template is a pure template with no additional static text,
                // And if the evaluated value is an object or an array, we return the object itself instead of
                // replacing it into template via string replace, since that will turn it into a string.
                if (full_re.test(template)) {
                  return evaluated;
                } else {
                  return template.replace(variable, '');
                }
              } else {
                return '';
              }
            }
          }
        }
        // REST OF THE CASES
        // if evaluated is null or undefined,
        // it probably means one of the following:
        //  1. The current data being parsed is not for the current template
        //  2. It's an error
        //
        //  In either case we need to return the original template unparsed.
        //    1. for case1, we need to leave the template alone so that the template can be parsed
        //      by another data set
        //    2. for case2, it's better to just return the template so it's easier to debug
        return template;
      } catch (err) {
        return template;
      }
    },
    
  };

  // Export
  if (typeof exports !== 'undefined') {
    var x = {
      TRANSFORM: TRANSFORM,
      transform: TRANSFORM,
      init: Initialization,
      Conditional: Conditional,
      Helper: Helper,
      transform: TRANSFORM.transform,
    };
    if (typeof module !== 'undefined' && module.exports) { exports = module.exports = x; }
    exports = x;
  } else {
    $context.ST = {
      init: Initialization,
      transform: TRANSFORM.transform,
    };
  }
}());
