import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function OtherOutcomes(props){


    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
    const margin = 10;
    const labelSpacing = 60;
    const titleSpacing = Math.max(height*.04,30);
    const modelSpacing = 5;
    const outcomeSpacing = 10;

    const mainPatientOutcomes=['OS (Calculated)(4yr)','FT','Aspiration rate Post-therapy','Locoregional control (Time)(4yr)'];


    //get dict of the keys in the simulation results and the corresponding file names for neigbhor stuff
    const simStates = useMemo(()=>{
        var keys = {'outcomes': ['FT','Aspiration rate Post-therapy']};
        // keys['temporal_outcomes'] = [...constants.TEMPORAL_OUTCOMES];
        if(props.state === 0){
            keys['pd1'] = constants.primaryDiseaseProgressions;
            keys['nd1'] = constants.nodalDiseaseProgressions;
            keys['dlt1'] = constants.dlts1;
        } else if(props.state === 1){
            keys['pd2'] = constants.primaryDiseaseProgressions2;
            keys['nd2'] = constants.nodalDiseaseProgressions2;
            keys['dlt2'] = constants.dlts2;
        }
        // if(props.state < 2){
        //     var toDel = [];
        //     if(props.outcomesView === 'disease response'){
        //         toDel = ['dlt1','dlt2','outcomes'];
        //     } else if(props.outcomesView === 'dlts'){
        //         toDel = ['pd1','nd1','pd2','nd2','outcomes'];
        //     } else if(props.outcomesView === 'no dlts'){
        //         toDel = ['dlt1','dlt2'];
        //     } else if(props.outcomesView === 'endpoints'){
        //         toDel = ['pd1','nd1','pd2','nd2','dlt1','dlt2'];
        //     }
        //     for(let d of toDel){
        //         delete keys[d];
        //     }
        // }
        return keys;
        
    },[props.state,props.outcomesView]);

    useEffect(()=>{
        if(!Utils.allValid([svg,props.sim,props.altSim,props.neighbors,props.cfs])){
            console.log('not valid stuff in outcomeplots',props);
        }else{
            console.log('outcomes',simStates);
            console.log('sim',props.sim);
            console.log('nieghboars',props.neighbors);

            svg.selectAll('g').remove();
            const g = svg.append('g');

            const outcomesToShow = props.outcomesToShow;
            var nRows = 0;
            var maxVars = 0;
            for(let [key,varList] of Object.entries(simStates)){
                nRows += varList.length;
                maxVars = Math.max(maxVars,varList.length);
            }
            nRows *= outcomesToShow.length;
            const colWidth = (width - 2*margin)/(maxVars + 1);

            var rowData = [];
            var currRow = 0;
            var currCol = 0;
            
            const colors = props.decision > .5? [constants.dnnColor,constants.dnnColorNo,constants.knnColor,constants.knnColorNo]: [constants.dnnColorNo,constants.dnnColor,constants.knnColorNo,constants.knnColor] 
            const modelNames = props.decision > .5? ['Treatment (predicted)','No Treatment (predicted)','Treatment (neighbors)','No Treatment (neighbors)']: ['No Treatment (predicted)','Treatment (predicted)','No Treatment (neighbors)','Treatment (neighbors)']
            for(let [key,varList] of Object.entries(simStates)){
                const nVals = props.sim[key];
                const cfVals = props.altSim[key];
                if(nVals === undefined){
                    console.log('ERROR',key);
                    continue
                }
                let i = 0;
                currCol = 0;
                for(let varName of varList){
                    let v1 = nVals[i];
                    let v2 = cfVals[i];
                    i += 1;

                    let v3 = Utils.mean(props.neighbors.map(d => d[varName]));
                    let v4 = Utils.mean(props.cfs.map(d => d[varName]));
                    
                    let vals = [-1,v1,v2,v3,v4];
                    var vpos = 1;
                    for(let vi in vals){
                        vi = parseInt(vi);
                        if(vi > 0 && props.outcomesToShow.indexOf(modelNames[vi-1])  < 0){
                            continue
                        }
                        if(vi === 0){
                            let entry = {
                                'row': parseInt(vpos+currRow),
                                'col': currCol,
                                'value': -1,
                                'groupName': key,
                                'varName': varName,
                                'modelName': '',
                                'color': 'none',
                                'groupNumber':currRow,
                                'displayText': Utils.getVarDisplayName(varName),
                            }
                            rowData.push(entry);
                            vpos += 1;
                        } else{
                            const val = vals[vi];
                            console.log('hwat the fuck',vi,currRow,vi+currRow)
                            let entry = {
                                'row': parseInt(vpos+currRow),
                                'col': currCol,
                                'value': val,
                                'groupName': key,
                                'varName': varName,
                                'modelName': modelNames[vi-1],
                                'color': colors[vi-1],
                                'groupNumber':currRow,
                                'displayText': (100*val).toFixed(1) + '%'
                            }
                            rowData.push(entry);
                            vpos += 1;
                        }
                    }
                    currCol += 1
                }
                currRow += 1+props.outcomesToShow.length;
            }

            console.log('rows',d3.max(rowData,d=>d.row),nRows)
            const rowHeight = Math.max(50,(height - 2*margin)/(d3.max(rowData,d=>d.row)+1));

            const getX = d => {
                return (d.col*colWidth) + margin;
            }
            const getY = d => {
                return ((d.row-1)*rowHeight) + margin;
            }

            console.log('rowData',rowData)
            g.selectAll('.tableRect').remove();
            g.selectAll('.tableRect').data(rowData)
                .enter().append('rect')
                .attr('class','tableRect')
                .attr('x',getX).attr('y',getY)
                .attr('height',rowHeight)
                .attr('width',colWidth)
                .attr('fill',d=>d.color)
                .attr('stroke', d=> d.modelName === ''? 'none':'black')
                .attr('fill-opacity',d => d.value);

            g.selectAll('.tableText').remove();
            g.selectAll('.tableText').data(rowData)
                .enter().append('text')
                .attr('class','tableText')
                .attr('x',d => getX(d) + colWidth/2)
                .attr('y',d=> getY(d) + rowHeight/2)
                .attr('dominant-baseline','middle')
                .attr('text-anchor','middle')
                .text(d=>d.displayText);

            const bbox = svg.selectAll('g').node().getBBox();

            svg.attr('height', 10 + bbox.height + bbox.y);
        }
    },[props.sim,props.altSim,props.neighbors,props.cfs,simStates,svg,props.mainDecision,simStates,props.width,props.outcomesToShow])

    return (
        <div
            className={"d3-component"}
            style={{'height':'auto','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}