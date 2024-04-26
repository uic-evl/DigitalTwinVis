import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function DoseEffectViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pathsDrawn, setPathsDrawn] = useState(false);
    const [box,setBox] = useState();
    const useChange = props.useChange;
    const margin = {'top':1,'bottom':1,'left':10,'right':40}

    useEffect(function drawBorders(){
        if(svg !== undefined & props.svgPaths !== undefined & props.effectData !== undefined & props.extents !== undefined){
            const metric = props.colorMetric;

            svg.selectAll('g').remove();
            svg.selectAll('path').remove();
            svg.selectAll('text').filter('.positionLabels').remove();
            setPathsDrawn(false);

            var metricTransform = x => -x;
            if(metric.includes('pval')){
                metricTransform = x => -(1/x);
            }
            var addedOrgans = props.effectData.map(d=>d.added_organs);
            var effectOrgans = new Set();
            for(let olist of addedOrgans){
                for(let organ of olist){
                    if(props.clusterOrgans.indexOf(organ) < 0) { effectOrgans.add(organ); }
                    // if(organ.includes('Rt_') | props.clusterOrgans.indexOf(organ) >= 0){
                    //     continue;
                    // } else{
                    //     effectOrgans.add(organ)
                    // }
                }
            }

            let dataSubset = props.effectData.filter(x=>x.symptom.includes(props.mainSymptom));
            let baseline = dataSubset.filter(x => parseInt(x.featurePos) == 0)[0];
            var baselineValue = 0;
            if(baseline !== undefined){
                baselineValue = baseline[metric+'_base'];
            } 
            
            dataSubset = dataSubset.filter(x=>parseInt(x.featurePos) == props.fPos);
            var getDatapoint = (o) => {
                let d = dataSubset.filter(x=>x.added_organs.includes(o));
                return d[0];
            }

            var getValue = (d) => {
                if(d === undefined){
                    return undefined;
                } else if(d[metric] === undefined){
                    return undefined;
                }
                let v = d[metric];
                if(useChange &  baselineValue !== undefined){
                    v = v - baselineValue;
                }
                return metricTransform(v)
            }

            let getClass = (d)=>{
                let cName = 'organEffectPath';
                if(!effectOrgans.has(d)){
                    cName += ' disabled';
                } 
                if(props.clusterOrgans.indexOf(d) >= 0){
                    cName += ' selected'
                }
                return cName
            }

            let paths = props.svgPaths['both'];
            let pathData = [];
            // let [minVal,maxVal] = [10000000000,0]
            let organPaths = [];

            //get all relevant paths
            for(let organ of Object.keys(paths)){
                //skip paths with nubmers (inner stuff)
                let flag = (organPaths.indexOf(organ) == -1);
                if(flag){
                    for(let k of [1,2,3,4,5,6,7,8,9]){
                        flag = (flag & !organ.includes(k));
                    } 
                }
                if(flag){
                    organPaths.push(organ);
                }
            }
            for(let organ of organPaths){
                let entry = {
                    'path': paths[organ],
                    'classname': getClass(organ),
                    'organ': organ,
                }
                let dPoint = getDatapoint(organ);
                if(dPoint !== undefined){
                    let val = getValue(dPoint);
                    entry['value'] = val;
                    for(let k of Object.keys(dPoint)){
                        entry[k] = dPoint[k];
                    }
                    // if(val !== undefined){
                    //     if(val > maxVal){ maxVal = val; }
                    //     if(val < minVal){ minVal = val; }
                    // }
                }
                pathData.push(entry);
            }

            const [minVal, maxVal] = props.extents;
            let colorScale = d3.scaleLinear()
                .domain([minVal,maxVal])
                .range([0,1])
            let interp = props.linearInterpolator;

            if(minVal < 0){
                colorScale = d3.scaleDiverging()
                    .domain([minVal,0,maxVal])
                    .range([0,.5,1])
                interp = props.divergentInterpolator;
            }

            let getColor = (d)=>{
                //fix later to have actual colors
                let value = d.value;
                if(value === undefined){
                    if(props.clusterOrgans.indexOf(d.organ) >= 0){
                        return 'red';
                    } else{
                        return '#d1d1d1d1'
                    }
                }
                return interp(colorScale(value));
                // return interp(colorScale(value))
            }

            svg.selectAll('g').filter('.organGroup').remove();
            const organGroup = svg.append('g')
                .attr('class','organGroup');
            
            organGroup.selectAll('.organPath').remove();

            const getStroke = d => {
                if(props.clusterOrganCue.indexOf(d.organ) >= 0){ return .6;}
                if(props.clusterOrgans.indexOf(d.organ) >= 0){ return .4;}
                return 0
            };

            const getStrokeColor = d => {
                let inFeatures = props.clusterOrgans.indexOf(d.organ) >= 0;
                let inCue = props.clusterOrganCue.indexOf(d.organ) >= 0;
                if(inFeatures & inCue){ return props.parameterColors.both; } 
                if(inFeatures){ return props.parameterColors.current; }
                if(inCue){ return props.parameterColors.cue; }
                return props.parameterColors.none;
            };

            const organShapes = organGroup
                .selectAll('path').filter('.organPath')
                .data(pathData)
                .enter().append('path')
                .attr('class','organPath')
                .attr('d',x=>x.path)
                .attr('fill', x=>getColor(x))
                .attr('stroke',getStrokeColor)
                .attr('stroke-width',getStroke)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = '';
                    let keys = ['organ','threshold','cluster','lrt_pval','aic_diff','bic_diff'];
                    for(let key of keys){
                        if(d[key] !== undefined){
                            tipText += key + ': '+ d[key] + '</br>';
                            let basekey = key+'_base'
                            if(d[basekey] !== undefined){
                                tipText += basekey + ': '+ d[basekey] + '</br>';
                            }
                        }
                    }
                    tipText += metric + ' improvement: ' + d.value + '</br>'
                    tipText += 'baseline ' + metric + ': ' + baselineValue;
                    tTip.html(tipText);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                }).on('contextmenu',function(e){
                    e.preventDefault();
                    let d = d3.select(this).datum();
                    let organ = d.organ;
                    props.addOrganToCue(organ);
                });;

            let box = svg.node().getBBox();
            let transform = 'translate(' + (-box.x)*((width-margin.right)/box.width)  
            transform += ',' + (-box.y)*((height-margin.top)/box.height) + ')'
            transform += ' scale(' + (width - margin.left - margin.right)/box.width + ',' 
            transform += (-(height - margin.top - margin.bottom)/box.height) + ')';
            organGroup.attr('transform',transform);
            setBox(box);
        }
    },[svg,props.svgPaths,props.effectData,props.clusterOrgans,props.colorMetric,props.fPos,props.clusterOrganCue,props.extents,props.useChange])



    useEffect(()=>{
        if(svg === undefined){ return; }
        if(box !== undefined){
            let labelData = [];
            let getTransform = (y) => {
                let tform = 'translate(0, ' + -((box.y + box.height/2) - y) +') ' ;
                tform += 'scale(1,-1) ' 
                tform += 'translate(0,' + ((box.y + box.height/2) - y) + ')';
                return tform;
            }

            if(props.showOrganLabels){
                svg.selectAll('.organPath').each((d,i,j) => {
                    if(!d.organ.toLowerCase().includes('side')){
                        let bbox = j[i].getBBox();
                        let organ = d.organ;
                        //trial and error tweaking names so they are small but readable ish
                        let name = Utils.truncateOrganNames(organ);
                        let fSize =  1.5*(bbox.width/name.length);
                        fSize = Math.min(5, Math.max(2.5,fSize))
                        let entry = {
                            x: bbox.x + bbox.width/2,
                            y: bbox.y + (bbox.height/2),
                            text: name,
                            fontSize: fSize,
                            textWidth: bbox.width*.8,
                            oData: d,
                            isOrgan: true,
                        }
                        //just trial and error making submandibular gland and digastric not collide
                        entry = Utils.adjustOrganSpacing(organ,entry);
                        entry.transform = getTransform(entry.y);
                        labelData.push(entry);
                    }
                    
                })
            }
            
            //this part draws 'contralateral' and 'ipsilateral' directly over the lateral pterygoids on each side
            var rLabel = false;
            var lLabel = false;
            svg.selectAll('.organPath').each((d,i,j) => {
                let organ = d.organ;
                if(organ.includes('Lateral_Pterygoid')){ 
                    //trial and error tweaking names so they are small but readable ish
                    const isLeft = organ.includes('Lt_');
                    if((isLeft & !lLabel) | (!isLeft & !rLabel)){
                        let bbox = j[i].getBBox();
                        let text = isLeft? 'Ipsilateral':'Contralateral'
                        let fSize =  2.2*(bbox.width/text.length);
                        fSize = Math.min(10, Math.max(2.5,fSize))
                        let entry = {
                            x: bbox.x + bbox.width/2,
                            y: bbox.y + (bbox.height/2) + fSize*2.5,
                            text: text,
                            fontSize: 1.25*fSize,
                            textWidth: bbox.width*1.5,
                            oData: d,
                            isOrgan: false,
                        }
                        entry.transform = getTransform(entry.y);
                        labelData.push(entry);
                        if(isLeft){ 
                            lLabel = true; 
                        } else{ 
                            rLabel = true;
                        }

                    }
                    //just trial and error making submandibular gland and digastric not collide
                }
            })

            let organGroup = svg.select('g').filter('.organGroup');
            organGroup.selectAll('.organLabel').remove();
            let labels = organGroup.selectAll('.organLabel')
                .data(labelData).enter()
                .append('text').attr('class','organLabel')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('font-size',d=>d.fontSize)
                .attr('text-anchor','middle')
                .attr('dominant-baseline','central')
                .attr('font-weight','bold')
                .attr('font-style',d=>d.isOrgan? '':'italic')
                .attr('transform',d=>d.transform)
                .attr('stroke',d => d.isOrgan? 'white':'')
                .attr('stroke-width',d=> d.isOrgan? .01*d.fontSize : 0)
                .attr('pointer-events','none')
                .attr('text-decoration',d=> d.isOrgan? '':'underline')
                .text(d=>d.text);
        } else{
             let labels = svg.selectAll('.organLabel')
             if(labels !== undefined){ labels.remove();}
        }
    },[svg,box, props.showOrganLabels])
    
    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}