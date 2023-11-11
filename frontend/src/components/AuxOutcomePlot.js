import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function AuxOutcomePlot(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    

    const xMargin = 10;
    const topMargin =1;
    const chartSpacing = 5;
    const bottomMargin = 40;
    const timePoints = [12,48];


    function radToCartesian(r,t,centerX=0,centerY=0){
        const x = centerX + r*Math.cos(t);
        const y = centerY + r*Math.sin(t);
        return [x,y];
    };

    const outcomeGroups = useMemo(()=>{
        var omap = {
            'temporal': ['OS (Calculated)','Locoregional control (Time)','FDM (months)','time_to_event'],
        }
        if(props.currState == 2){
            omap['outcomes'] = constants.OUTCOMES;
        } else if(props.currState == 1){
            omap['pd2'] = constants.primaryDiseaseProgressions2;
            omap['nd2'] = constants.nodalDiseaseProgressions2;
            omap['dlt2'] = constants.dlts2;
            
        } else{
            omap['pd1'] = constants.primaryDiseaseProgressions;
            omap['nd1'] = constants.nodalDiseaseProgressions;
            omap['dlt1'] = constants.dlts1;
        }
        if(svg) { svg.selectAll().remove(); }
        return omap
    },[props.currState,svg])
    
    useEffect(()=>{
        if(!Utils.allValid([svg,props.sim,props.altSim,props.neighbors,props.cfs])){
            console.log('not valid stuff in outcomeplots',props);
        }else{
            
            const sim = props.sim;
            const altSim = props.altSim;
            const survivalCurves = sim['survival_curves'];
            const altCurves = altSim['survival_curves'];
            const times = survivalCurves.times;
            const timeIdxList = timePoints.map(t => times.indexOf(t)).filter(idx => idx >= 0);
            const lineColors = sim.currDecision >= .5? [constants.dnnColor,constants.dnnColorNo,constants.knnColor,constants.knnColorNo]: [constants.dnnColorNo,constants.dnnColor,constants.knnColorNo,constants.knnColor];
            
            function drawKiviatCurve(centerX, centerY, radius, variables, colors,selector,scales){
                //I'm assuming varaibles is a list of a list of variables, each of leng nvariables
                const radiusScale = d3.scaleSqrt()
                    .domain([0,1]).range([radius/10,radius]);
                const thetaScale = d3.scaleLinear()
                    .domain([0,variables[0].length])
                    .range([Math.PI/2,2.5*Math.PI]);

                var paths = [];
                for(let idx in variables){
                    let vals= variables[idx];
                    if(vals === undefined || Utils.sum(vals) == 0){
                        continue
                    }
                    let plotvals = vals;
                    if(scales !== undefined && scales[idx] !== undefined){
                        plotvals = plotvals.map(d => scales[idx](d));
                    }
                    let path = [];
                    let radii = [];
                    let thetai = [];
                    for(let idx2 in vals){
                        let r = radiusScale(plotvals[idx2]);
                        let theta = thetaScale(idx2);
                        radii.push(r);
                        thetai.push(theta)
                        const [x,y] = radToCartesian(r,theta,centerX,centerY);
                        path.push([x,y]);
                    }
                    path.push(path[0]);
                    paths.push({
                        'path':d3.line().curve(d3.curveCardinal.tension(.8))(path),
                        'pathPoints': path,
                        'color': colors[idx],
                        'vals': vals, 
                        'radii': radii,
                        'thetas': thetai,
                        'active': Number(idx)%2 === 1,
                    })
                }
                function getClass(d){
                    let c = selector;
                    if(d.active){ c += ' active'}
                    return c
                }
                const pathGroup = svg.selectAll('path').filter('.'+selector).data(paths);
                pathGroup.enter()
                    .append('path').attr('class',getClass)
                    .merge(pathGroup)
                    .transition(100)
                    .attr('d',d=>d.path)
                    .attr('fill',(d,i) => i==0? 'none':d.color)
                    .attr('stroke',(d,i) => i==0? d.color:'none')
                    .attr('stroke-width',2)
                    .attr('fill-opacity',(d,i) => i == 0? 0:.25)
                    // .attr('stroke',d=>d.color)
                    // .attr('stroke-width',(d,i) => i==0?2:5)
                    // .attr('stroke-opacity',.8)
                    // .attr('fill','none');

                const title = Utils.getFeatureDisplayName(selector.replace('-',' '));
                const titleSize = Math.min(20,bottomMargin/1.75);
                svg.selectAll('text').filter('.'+selector+'title').remove();
                svg.append('text').attr('class',selector+'title')
                    .attr('x', centerX).attr('y',height - bottomMargin/2)
                    .attr('font-size',titleSize)
                    .attr('text-anchor','middle')
                    .attr('dominant-baseline','middle')
                    .attr('textLength',title.length*titleSize  > 1.8*radius? 1.8*radius:'')
                    .attr('lengthAdjust','spacingAndGlyphs')
                    .text(title);
                pathGroup.exit().remove();
                //raise recommended outcome to top
                svg.selectAll('.active').raise();
            }
            const nPlots = Object.values(outcomeGroups).length + (timePoints.length-1);
            const pradius = Math.min((height - topMargin - bottomMargin)/2, .5*(((width - 2*xMargin)/nPlots) - chartSpacing));
            var currCX = xMargin + pradius;

            for(const [k,v] of Object.entries(outcomeGroups)){
                const outline = v.map(d => 1);
                if(k == 'temporal'){ 
                    for(let tIdx of timeIdxList){
                        let kvals = v.map(vname => survivalCurves[vname][tIdx]);
                        let altvals = v.map(vname => altCurves[vname][tIdx]);
                        const valList = [outline,kvals,altvals]
                        const name = 'survival-'+times[tIdx]+'-Months'
                        drawKiviatCurve(currCX,(height - bottomMargin + topMargin)/2,pradius,valList,
                        ['grey'].concat(lineColors),name);
                        currCX += 2*pradius + chartSpacing;
                    }
                }
                else{
                    const kVals = sim[k];
                    const altvals = altSim[k];
                    const nCurveVals = v.map(vname => props.neighbors.map(d => d[vname]));
                    const nMeans = nCurveVals.map(Utils.mean);
                    const cfCurveVals = v.map(vname => props.cfs.map(d => d[vname]));
                    const cfMeans = cfCurveVals.map(Utils.mean);
                    const valList = [outline,kVals,altvals,nMeans,cfMeans];
                    drawKiviatCurve(currCX,(height - bottomMargin + topMargin)/2,pradius,valList,
                        ['grey'].concat(lineColors),k);
                    currCX += 2*pradius + chartSpacing;
                }
                
            }
        }
    },[props.sim,props.altSim,props.neighbors,props.cfs,props.currState,svg,outcomeGroups])

    const className = props.className? props.className:'';
    return (
        <div
            className={"d3-component " + className}
            style={{'height':'95%','width':'95%','overflowY':'scroll'}}
            ref={d3Container}
        ></div>
    );
}