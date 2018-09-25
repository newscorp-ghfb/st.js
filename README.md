# Newscorp Extension
Please see https://selecttransform.github.io/site/transform.html for other transform functionality.

We extended this library to add the concept of subtemplating. You can define a subtemplate like so:
```
"summary": {
    "{{#template}}":{
    "template" : "Text",
    "inputProperty": "summary"
  }},
```
If the Text template is 
```
{
  "text": "{{#? text}}",
  "style": "{{#? style}}",
}
```
Given data input `{"summary":{"text": "blah blah", "style": "simple"}}`, this would output `{"summary":{"text": "blah blah", "style": "simple"}}`. 

We can also define a formatter, which alters the format of the data passed in to the template, and constantData, which is an object of keys and values that will always be in the subtemplate's namespace. For example, if our data input was instead `{"summary":"blah blah"}` and we want style to be simple for all output, we could have template 
```
"summary": {
    "{{#template}}":{
    "template" : "Text",
    "formatter": "summary",
    "constantData": {
      "style": "simple"
    }
  }}
```
Then, if the formatter function was given as:
```
function summary(data){
  const newData = {}
  newData.summary = {}
  newData.summary.text = data.summary
  return newData;
}
```
we would obtain the desired result.

Currently, subtemplates and formatters must each be in their own folder. When loading st.js, you must specify the folders like so:
`ST.init({"templatesFolder":getFolderPath("templates"),
  "formattersFolder":getFolderPath("formatters")})`

# ST

JSON Selector + Transformer

- Website: [https://selecttransform.github.io/site](https://selecttransform.github.io/site)
- Twitter: [@selecttransform](https://www.twitter.com/selecttransform)

---

![preview](https://gliechtenstein.github.io/images/st.gif)

1. **Select:** Query any JSON tree to select exactly the subtree you are looking for.
2. **Transform:** Transform any JSON object to another by parsing with a template, also written in JSON

You can also mix and match Select AND Transform to perform partial transform, modularize JSON objects, etc.

# Features

## 1. Select

Select a JSON object or its subtree that matches your criteria

> Step 1. Take any JSON object

```js
var data = {
  "links": [
    { "remote_url": "http://localhost" },
    { "file_url": "file://documents" },
    { "remote_url": "https://blahblah.com" }
  ],
  "preview": "https://image",
  "metadata": "This is a link collection"
}
```

> Step 2. Find all key/value pairs that match a selector function

```js
var sel = ST.select(data, function(key, val) {
  return /https?:/.test(val);
})
```

> Step 3. Get the result

```js
var keys = sel.keys();
//  [
//    "remote_url",
//    "remote_url",
//    "preview"
//  ]

var values = sel.values();
//  [
//    "http://localhost",
//    "https://blahblah.com",
//    "https://image"
//  ]

var paths = sel.paths();
//  [
//    "[\"links\"]",
//    "[\"links\"]",
//    ""
//  ]
```

## 2. Transform

Use template to transform one object to another

> Step 1. Take any JSON object

```js
var data = {
  "title": "List of websites",
  "description": "This is a list of popular websites"
  "data": {
    "sites": [{
      "name": "Google",
      "url": "https://google.com"
    }, {
      "name": "Facebook",
      "url": "https://facebook.com"
    }, {
      "name": "Twitter",
      "url": "https://twitter.com"
    }, {
      "name": "Github",
      "url": "https://github.com"
    }]
  }
}
```

> Step 2. Select and transform with a template JSON object

```js
var sel = ST.select(data, function(key, val){
            return key === 'sites';
          })
          .transformWith({
            "items": {
              "{{#each sites}}": {
                "tag": "<a href='{{url}}'>{{name}}</a>"
              }
            }
          })

```


> Step 3. Get the result

```js
var keys = sel.keys();
//  [
//    "tag",
//    "tag",
//    "tag",
//    "tag"
//  ]

var values = sel.values();
//  [
//    "<a href='https://google.com'>Google</a>",
//    "<a href='https://facebook.com'>Facebook</a>",
//    "<a href='https://twitter.com'>Twitter</a>",
//    "<a href='https://github.com'>Github</a>"
//  ]

var objects = sel.objects();
//  [
//    {
//      "tag": "<a href='https://google.com'>Google</a>"
//    }, {
//      "tag": "<a href='https://facebook.com'>Facebook</a>"
//    }, {
//      "tag": "<a href='https://twitter.com'>Twitter</a>"
//    }, {
//      "tag": "<a href='https://github.com'>Github</a>"
//    }
//  ]

var root = sel.root();
//  {
//    "items": [{
//      "tag": "<a href='https://google.com'>Google</a>"
//    }, {
//      "tag": "<a href='https://facebook.com'>Facebook</a>"
//    }, {
//      "tag": "<a href='https://twitter.com'>Twitter</a>"
//    }, {
//      "tag": "<a href='https://github.com'>Github</a>"
//    }]
//  }
```

---

# Usage

## In a browser

```js
<script src="st.js"></script>
<script>
var parsed = ST.select({ "items": [1,2,3,4] })
                .transformWith({
                  "{{#each items}}": {
                    "type": "label", "text": "{{this}}"
                  }
                })
                .root();
</script>
```

## In node.js

> Install through npm:

```bash
$ npm install stjs
```

> Use

```js
const ST = require('st');

const parsed = ST.select({ "items": [1,2,3,4] })
                .transformWith({
                  "{{#each items}}": {
                    "type": "label", "text": "{{this}}"
                  }
                })
                .root();
```

### Learn more at [selecttransform.github.io/site](https://selecttransform.github.io/site)
