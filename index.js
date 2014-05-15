'use strict';

var mongoose = require('mongoose'),
      _                 = require('lodash'),
      pascal        = require('to-pascal-case'),
      slugs          = require('slugs');

function slugify(model, options){
    var slugParts = _.values(_.pick(model, options.source));
    return slugs(slugParts.join(' '));
}

function getModel(document, options){
    var modelName = pascal(options.modelName || document.collection.name);
    return mongoose.model(modelName);
}

function incrementAndSave(document, options, cb){
    var Model = getModel(document, options);
    var params = {};
    var slugbaseKey = options.slugBase;
    var itKey = options.slugIt;
    params[slugbaseKey] = document[slugbaseKey];

    Model.findOne(params).sort('-'+itKey).exec(function(e, doc){
        if(e) return cb(e);

        var it = (doc[itKey] || 0) + Math.ceil(Math.random()*10);

        document[itKey] = it;
        document[options.slugName] = document[slugbaseKey]+'-'+it;

        return document.save(cb);
    });
}

function Slugin(schema, options){
    options = _.defaults(options || {}, Slugin.defaultOptions);
    if(_.isString(options.source))
        options.source = [options.source];
    options.slugIt = options.slugName + '_it';
    options.slugBase = options.slugName + '_base';
    var fields = {};
    fields[options.slugName] = {
        type : String,
        unique: true
    };

    fields[options.slugBase] = {
        type: String,
        index:true
    };

    fields[options.slugIt] = {
        type: Number
    };

    schema.add(fields);

    schema.pre('save', function(next){
        var slugBase = slugify(this,options);
        if(this[options.slugBase] !== slugBase){  // TODO: handle changes to the source
            this[options.slugName] = slugBase;
            this[options.slugBase] = slugBase;
            delete this[options.slugIt]
        }
        next();
    });

    schema.methods.save = function(cb){
        var self = this;
        mongoose.Model.prototype.save.call(self, function(e, model, num){
            if(e && e.code === 11000 && !!~e.err.indexOf(self[options.slugName])){
                incrementAndSave(self, options, cb);
            }else{
                cb(e,model,num);
            }
        });
    };
}

Slugin.defaultOptions = {
    slugName : 'slug',
    source : 'title',
    modelName : null
};

module.exports = Slugin;