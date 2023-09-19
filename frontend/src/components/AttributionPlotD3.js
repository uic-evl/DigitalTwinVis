import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function AttributionPlotD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
    const margin = 20;
    const labelSpacing = Math.max(width/5,80);
    const topMargin = 20;
    const bottomMargin = 30

    const minAttribution = 0.0001;

    function makeArrow(height,width,radius){
        //negative width is pointing in other diection
        if(radius === undefined){
            radius = Math.min(Math.abs(height/2),Math.abs(width/2));
        }
        let offset = Math.sign(width)*radius;
        let string = 'M 0,0' + ' '
            + '0,' + (height) + ' ' 
            + (width - offset) + ',' + height + ' '
            + width + ',' + (height/2) + ' '
            + (width - offset) + ',0' + ' '
            + '0,0z';
        return string
    }

    function formatText(v){
        let t = (v*100).toFixed(0) + '%';
        if(v > 0){
            t = '+' + t;
        }
        return t;
    }
    // useMemo(()=>{
    //     if(props.defaultPredictions !== undefined){
    //         const defaultP = props.defaultPredictions[props.modelOutput][constants.DECISIONS[props.currState]]
    //         console.log('default pred',defaultP);
    //     }
    // },[props.defaultPredictions,props.modelOutput,props.currState]);
    function getSimulationKey(){
        if(!Utils.allValid([props.simulation,props.modelOutput,props.fixedDecisions])){return undefined}
        let key = props.modelOutput;
        for(let i in props.fixedDecisions){
          let d = props.fixedDecisions[i];
          let di = parseInt(i) + 1
          if(d >= 0){
            let suffix = '_decision'+(di)+'-'+d;
            key += suffix;
          }
        }
        return key
    }
    

    useMemo(()=>{
        if(svg !== undefined & props.simulation !== undefined){
            const simKey = getSimulationKey();
            const res = props.simulation[simKey]['decision'+(props.currState+1)+'_attention'];
            var validKeys = ['baseline','dlt1','dlt2','nd','pd'];
            // so commenting this will let me see if I get attributions it should get
            if(props.currState == 1){
                validKeys = ['baseline','dlt1','nd','pd']
            } else if(props.currState == 2){
                validKeys = ['baseline','dlt1','nd','pd']
            }
            var data = {'other':0,'dlt': 0,'Ipsilateral LNs':0,'Contralateral LNs': 0,'Nodal Response': 0,'Primary Response': 0};
            var otherEntries = [];
            
            function addAttribution(d,key,value){
                value = value === undefined? 0: value;
                if(d[key] !== undefined){
                    d[key] = d[key] + value;
                } else {
                    d[key] = value;
                }
                return d
            }
            for(let key of validKeys){
                let newData = res[key];
                let isDlt = key.includes('dlt');
                let isPd = key == 'pd';
                let isNd = key == 'nd';
                if(newData === undefined){
                    console.log('key invalid',key,res);
                    continue
                }
                for(const [key2,val] of Object.entries(newData)){
                    let vkey = isDlt? 'DLT': key2;
                    if(key2.includes('_ipsi')){
                        vkey = 'Ipsilateral LNs';
                    } else if(key2.includes('contra')){
                        vkey = 'Contralateral LNs';
                    } else if(Math.abs(val) < minAttribution){
                        vkey = 'other';
                        otherEntries.push(key2)
                    } else if(isPd){
                        vkey = 'Primary Response';
                    } else if(isNd){
                        vkey = 'Nodal Response';
                    }
                    data = addAttribution(data,vkey,val)
                }
            }
            for(let [k,v] of Object.entries(data)){
                if(Math.abs(v) < minAttribution & v !== undefined){
                    data['other'] = data['other'] + v;
                    if(k !== 'other'){
                        delete data[k];
                    }
                }
            }
            var positiveTotal = 0;
            var negativeTotal = 0;
            for(let [k,v] of Object.entries(data)){
                if(v > 0){
                    positiveTotal += v;
                } else{
                    negativeTotal += Math.abs(v);
                }
            }


            const defaultP = props.defaultPredictions[props.modelOutput][constants.DECISIONS[props.currState]];
            const decision = props.simulation[simKey]['decision'+(props.currState+1)];
            const discrepency = (decision - defaultP) - (positiveTotal - negativeTotal);
            data['other'] = discrepency + data['other'];
            if(discrepency > 0){
                positiveTotal += discrepency;
            } else{
                negativeTotal += discrepency;
            }

            //data should now be a dictionayr of values
            const keys = Object.keys(data);
            const attributions = Object.values(data);

            const amplitude = Math.max(positiveTotal,negativeTotal,.000000000000000000000001);
            // const aExtents = d3.extent(attributions);
            // const amplitude = Math.abs(Math.max(-aExtents[0],aExtents[1]));
            const xScale = d3.scaleLinear()
                .domain([0,amplitude])
                .range([width/2,width-margin]);
            // const centerX = negativeTotal > positiveTotal? labelSpacing + xScale(negativeTotal) - xScale(positiveTotal): labelSpacing;
            const centerX = width/2;
            const colorScale = Utils.getColorScale('attributions',res.range[0],res.range[1]);

            const barWidth = (height - bottomMargin - topMargin)/(attributions.length);
            
            //modified from https://stackoverflow.com/questions/46622486/what-is-the-javascript-equivalent-of-numpy-argsort
            //to actually return args with the last map function
            const argsort = (arr1, arr2) => arr1
                .map((item, index) => [arr2[index], item]) // add the args to sort by
                .sort(([arg1], [arg2]) => arg2 - arg1) // sort by the args
                .map(([, item]) => item)
                .map(item => arr1.indexOf(item)); //extract sorted items
            const sortedIdx = argsort(keys,attributions);
            var rectData = [];
            var yPos = topMargin;
            var currX = centerX;
            for(const idx of sortedIdx){
                const varName = keys[idx];
                const attribution = attributions[idx];
                let x = currX;
                const w = Math.sign(attribution)*(xScale(Math.abs(attribution)) - width/2);
                const entry = {
                    'name': varName,
                    'val': attribution,
                    'width': w,
                    'x': x,
                    'y': yPos,
                    'height': barWidth-1,
                }
                entry.path = makeArrow(entry.height,entry.width);
                rectData.push(entry);
                currX += w;
                yPos += barWidth;
            }

            svg.selectAll('g').remove();
            let group = svg.append('g');

            group.selectAll('.aRect').remove();
            group.selectAll('.aRect')
                .data(rectData).enter()
                .append('path').attr('class','aRect offset')
                .attr('d',d=>d.path)
                .attr('transform', d=> 'translate(' + d.x + ',' + d.y + ')')
                .attr('fill',d=> colorScale(d.val))
                .attr('stroke-width',1)
                .attr('stroke','black')
                .on('mouseover',function(e,d){
                    let string = d.name + '</br>'
                        + 'attribution: ' + formatText(d.val);
                    if(d.name === 'other'){
                        string += '</br>' + 'features:';
                        for(let v of otherEntries){
                            string += v + ', '
                        }
                    }
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                })

            const labelSize = Math.min(20,barWidth*.8);
            group.selectAll('text').remove();
            group.selectAll('.labelRect')
                .data(rectData).enter()
                .append('text').attr('class','labelRect')
                .attr('x',d=>d.x-5 + Math.min(d.width,0))
                .attr('y',d=>d.y + labelSize)
                .attr('text-anchor','end')
                .attr('font-size',labelSize)
                .text(d=>Utils.getFeatureDisplayName(d.name));

            const ticks = [
                [[centerX, yPos],[centerX,yPos+5]],
                [[currX, yPos],[currX,yPos+5]],
            ];
            //theortically defaultP - negativeTotal + postitiveTotal but off due to rounding errors
            const baseTick = {
                'path': d3.line()(ticks[0]),
                'x': centerX,
                'value': defaultP
            }
            const endTick = {
                'path': d3.line()(ticks[1]),
                'x':currX,
                'value': decision,
            }
            const tickData = [baseTick,endTick];
            group.selectAll('.ticks').remove();
            group.selectAll('.lineTicks').data(tickData)
                .enter().append('path')
                .attr('class','ticks lineTicks offset')
                .attr('d',d=>d.path)
                .attr('stroke','gray')
                .attr('stroke-width',3);

            group.selectAll('.textTicks')
                .data(tickData)
                .enter().append('text')
                .attr('class','ticks textTicks offset')
                .attr('x',d=>d.x)
                .attr('y',yPos + bottomMargin/2 + 5)
                .attr('text-anchor','middle')
                .attr('font-size',bottomMargin/2)
                .text(d=>(100*d.value).toFixed() + '%');

            // let leftMost = Math.min(currX, centerX);
            // group.attr('transform','translate(' +  -1*(leftMost - labelSpacing) + ')');
            const bounds = group.node().getBBox();
            group.attr('transform','translate(' +  -1*(bounds.x - margin) + ')');
        }
    },[svg,props.simulation,props.modelOutput,props.currState,width,height,props.defaultPredictions,props.fixedDecisions]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}