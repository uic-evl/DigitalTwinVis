// import * as constants from './Constants';
import { quantile, qunatileRank } from 'simple-statistics';
import Utils from './Utils.js';
import * as d3 from 'd3';

export default class ColorManager {

    constructor(args){
    }

    getInterpolator(varName){
        //pre-defined color scales to use
        switch(varName){
            default:
                return d3.interpolateGreys;
                break;
        }
    }

    makeQuantiles(values){
        var valueRanges = Utils.arrange(.5,1,Math.round(values.length/3)+1);
        console.log('values',values, valueRanges);
        var qs = quantile(values.filter( d => d > 0), valueRanges);
        var scale = d3.scaleLinear()
            .domain(qs)
            .range(valueRanges);
        return scale
    }

    colorScaleFromExtents(extents, varName=''){
        var interpolator = this.getInterpolator(varName);
        if(extents.min < 0){
            var scale = d3.scaleSymlog()
                .domain([extents.min, 0, extents.max])
                .range([0,.5, 1]);
        } else{
            var scale = d3.scaleSymlog()
                .domain([extents.min, extents.max])
                .range([0.1,1]);
        }

        var getColor = (d) => {return interpolator(scale(d))};
        return getColor.bind(this)
    }

    makeQuantileColorScale(values, varName=''){
        var qScale = this.makeQuantiles(values);
        var interpolator = this.getInterpolator(varName);

        var getColor = (v) => interpolator(qScale(v));
        return getColor
    }

    colorsFromQuantileCounts(qCounts, varName=''){
        var interpolator = this.getInterpolator(varName);
        let minHue = .2;
        let increment = (1 - minHue)/qCounts.length;
        let colorList = [];
        for(var i=minHue; i < 1; i = i + increment){
            let color = interpolator(i+increment);
            colorList.push(color)
        }
        return colorList;
    }
    
}