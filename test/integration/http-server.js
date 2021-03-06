'use strict';

var _ = require('lodash');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var store = {};

app.use(bodyParser.json({ type: 'application/vnd.contentful.management.v1+json' }));
app.use(function (req, res, next) {
  let accessToken = req.query.access_token;

  if (accessToken !== 'lol-token') {
    res.status(404);
    res.end();
  } else {
    next();
  }
});

app.all('/spaces/:space/widgets/:id', function (req, res, next) {
  if (req.params.id === 'not-found') {
    let error = buildError('NotFound', 'The resource can\'t be found.');

    res.status(404);
    res.send(error);
    res.end();
    return;
  }

  if (req.params.id === 'fail') {
    let error = buildError();

    res.status(500);
    res.send(error);
    res.end();
    return;
  }

  next();
});

app.post('/spaces/:space/widgets', function (req, res) {
  if (_.get(req, 'body.widget.fieldTypes[0].type') === 'Lol') {
    return respondWithValidationError(res, {
      path: ['widget', 'fieldTypes'],
      expected: ['Symbol', 'Yolo']
    });
  }

  let widget = createWidget(req.params.space, req.params.id, req.body);

  res.status(201);
  res.json(widget);
  res.end();
});

app.put('/spaces/:space/widgets/:id', function (req, res) {
  let widget = store[req.params.id];
  let versionInHeader = req.headers['x-contentful-version'];
  let xVersion = versionInHeader ? parseInt(versionInHeader, 10) : undefined;

  if (!widget) {
    if (req.params.id === 'too-long-name') {
      return respondWithValidationError(res, {path: ['widget', 'name']});
    } else if (req.params.id === 'so-invalid') {
      return respondWithValidationError(res);
    } else if (req.params.id === 'too-big') {
      return respondWithValidationError(res, {
        path: ['widget', 'srcdoc'],
        max: 7777
      });
    }

    let widget = createWidget(req.params.space, req.params.id, req.body);

    store[req.params.id] = widget;
    res.status(201);
    res.json(widget);
    res.end();
  } else {
    if (req.params.id === 'fail-update') {
      let error = buildError();

      res.status(500);
      res.send(error);
      res.end();
      return;
    }

    if (xVersion !== widget.sys.version) {
      res.status(409);
      res.end();
    } else {
      let sys = widget.sys;

      widget = req.body;
      widget.sys = sys;
      widget.sys.version = widget.sys.version + 1;
      store[req.params.id] = widget; // Update the store

      res.json(widget);
      res.status(200);
      res.end();
    }
  }
});

app.get('/spaces/:space/widgets', function (req, res) {
  let widgets = _.filter(store, {sys: {space: {sys: {id: req.params.space}}}});
  let response = { sys: {type: 'Array'}, total: widgets.length, items: widgets };

  if (req.params.space === 'fail') {
    let error = buildError();

    res.status(500);
    res.send(error);
    res.end();
    return;
  }

  res.status(200);
  res.json(response);
  res.end();
});

app.get('/spaces/:space/widgets/:id', function (req, res) {
  let widget = store[req.params.id];

  res.status(200);
  res.json(widget);
  res.end();
});

app.delete('/spaces/:space/widgets/:id', function (req, res) {
  let widget = store[req.params.id];
  let xVersion = parseInt(req.headers['x-contentful-version'], 10);

  if (req.params.id === 'fail-delete') {
    let error = buildError();

    res.status(500);
    res.send(error);
    res.end();
    return;
  }

  if (xVersion !== widget.sys.version) {
    res.status(409);
    res.end();
  } else {
    delete store[req.params.id];
    res.status(204);
    res.end();
  }
});

function createWidget (spaceId, id, payload) {
  return _.extend(payload, {
    sys: {
      version: 1,
      id: id || _.random(1000),
      space: {
        sys: {
          id: spaceId
        }
      }
    }
  });
}

function buildError (id, message, error) {
  return _.extend({
    sys: {
      id: id || 'ServerError'
    },
    message: message || 'Server failed to fulfill the request.',
    details: {errors: [error || {}]}
  });
}

function respondWithValidationError (res, err) {
  res.status(422);
  res.send(buildError('ValidationFailed', null, err));
  res.end();
}

var server;

exports.start = function start () {
  server = app.listen(3000);
};

exports.stop = function stop () {
  store = {};
  server.close();
};
