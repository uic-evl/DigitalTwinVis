import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";

function getProgressionVars(state){
    if(state < 1){
        return []
    } if(state == 1){
        return Object.keys(constants.progressionVars).filter(d=>d.includes('IC'));
    }
    return Object.keys(constants.progressionVars).filter(d=>d.includes('CC'));
}

export default function PatientEditor(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const [varScales,setVarScales] = useState();
    const [meanVals,setMeanVals]= useState();

    const topMargin = Math.min(height/15,60);
    const bottomMargin = 40;
    const xMargin = 40;
    const textSpacing = 0;

    const ordinalVars = constants.ordinalVars;
    const booleanVars = constants.booleanVars.filter(d=>!d.includes('subsite'));
    const continuousVars = constants.continuousVars;

    const allVars = Object.keys(ordinalVars)
    .concat(continuousVars)
    .concat(booleanVars)
    .concat(getProgressionVars(props.currState))
    // .concat(['placeholder'])
    // .concat(constants.DECISIONS);
    // .concat(['placeholder2'])
    // .concat(constants.OUTCOMES);

    const xRange = [textSpacing+xMargin,width-xMargin];
    
    const yScale = d3.scaleLinear()
            .domain([0,allVars.length-1])
            .range([height-bottomMargin,topMargin]);

    const lineSpacing = Math.abs(yScale(1) - yScale(0));

    function getSim(){
        //get simulation but inside call so it doesn't break the drag stuff
            if(!Utils.allValid([props.simulation,props.modelOutput,props.fixedDecisions])){return undefined}
            let key = props.modelOutput;
            let allFixed = true;
            for(let i in props.fixedDecisions){
                let d = props.fixedDecisions[i];
                let di = parseInt(i) + 1
                if(d >= 0){
                let suffix = '_decision'+(di)+'-'+d;
                key += suffix;
                } else{
                    allFixed = false;
                }
            }
            //I only saved 'optimal' if all are fixed to avoid repitition for when all decisions are fixed since its the same
            if(allFixed){
                key = key.replace('imitation','optimal')
            }
            return props.simulation[key]
        }

    function getY(key){
        let pos = allVars.indexOf(key);
        if(pos < 0){
            console.log('bad x key',key,allVars);
        }
        return yScale(pos);
    }

    const getRadius = (id)=>{
        if(id === -1){
            return Math.min(lineSpacing/4,20);
        }
        return 7;
    }

    function makeScales(cData){
        var scales = {};
        var means = {};
        const range = xRange;
        for(const [key,entry] of Object.entries(ordinalVars)){
            if(allVars.indexOf(key) < 0){ continue; }
            scales[key] = d3.scaleLinear()
                .domain([entry[0],entry[entry.length-1]])
                .range(range);
        }
        let pVals = Object.values(cData);
        for(const key of continuousVars){
            if(allVars.indexOf(key) < 0){ continue; }
            let vals = pVals.map(d=>d[key]);
            scales[key] = d3.scaleLinear()
                .domain(d3.extent(vals))
                .range(range);
            means[key] = d3.median(vals);
        }
        for(const key of booleanVars.concat(constants.DECISIONS).concat(constants.OUTCOMES)){
            if(allVars.indexOf(key) < 0){ continue; }
            scales[key] = d3.scaleLinear()
                .domain([0,1])
                .range(range);
            means[key] = 0
        }
        for(const [key,entry] of Object.entries(constants.progressionVars)){
            const s = d3.scaleLinear()
                .domain([0,entry.length - 1])
                .range(xRange);
            scales[key] = s;
        }
        return [scales, means]
    }

    function encodeOrdinal(p,key,values,scale=false){
        let val = values[0];
        let isMissing=true;
        for(let i of values){
            if(p[key+'_'+i] > 0){
                val = i;
                isMissing = false;
                break;
            }
        }
        return val
    }

    function encodePatient(p,isSimulated=false){
        let values = {}
        for(const [key,v] of Object.entries(ordinalVars)){
            values[key] = encodeOrdinal(p,key,v);
        }
        for(let key of continuousVars){
            let val = p[key] === undefined? meanVals[key]:p[key];
            values[key] = val;
        }
        for(let key of booleanVars){
            let val = p[key] === undefined? 0:p[key];
            values[key] = val;
        }
        for(let key of constants.DECISIONS){
            if(isSimulated){
                let loc = constants.DECISIONS.indexOf(key);
                let decision = getSim()['decision'+(loc+1)];
                values[key] = decision;
            } else{
                let val = p[key] === undefined? 0:p[key] > .5;
                values[key] = val;
            }
        }
        for(let key of constants.OUTCOMES){
            if(isSimulated){
                let loc = constants.OUTCOMES.indexOf(key);
                let outcome = getSim()['outcomes'][loc];
                values[key] = outcome;
            } else{
                let val = p[key] === undefined? 0:p[key];
                values[key] = val;
            }
        }
        for(let [key,entry] of Object.entries(constants.progressionVars)){
            let i = 0;
            let val = -1;
            let currPct = 0;
            for(let n of entry){
                if(p[n] > currPct){
                    val = i;
                    currPct = p[n];
                }
                i+=1
            }
            if(val < 0){
                // console.log('bad val',p)
                val = 0;
            }
            values[key] = val;
        }
        // console.log('enocded values',values,p);
        return values;
    }

    function makePanel(){
        //pass
        let mainPatient = encodePatient(props.patientFeatures,true);

        const simResults = props.simulation[props.modelOutput];
        const decision = simResults['decision'+(props.currState+1)];
        const attention = simResults['decision'+(props.currState+1)+'_attention'];

        const attentionScale = Utils.getColorScale('attributions',attention.range[0],attention.range[1]);
        // const attentionScale = d3.scaleDiverging()
        //     .domain([attention.range[0], 0, attention.range[1]])
        //     .range(constants.divergingAttributionColors);


        function getAttention(key){
            let aVal = 0;
            if(ordinalVars[key] !== undefined){
                let vals = ordinalVars[key];
                let keys = vals.map(i => key + '_' + i);
                for(let key of keys){
                    aVal += attention.baseline[key];
                }
            }
            else{
                aVal = attention.baseline[key];
            }
            return aVal
        }


        function getX(value,key){
            let s = varScales[key];
            if(s === undefined){
                console.log('bad value in getX patienteditor',value,key,varScales,s)
                return width/2;
            }

            return s(value);
        }

        

        let pData = [];

        for(let key of allVars){
            if(key.includes('placeholder')){continue}
            let val = mainPatient[key];
            val = val === undefined? 0: val;
            let x = getX(val,key);
            let y = getY(key);
            let attentionV = getAttention(key);
            let className = 'patientMarker mainPatient';
            if(constants.OUTCOMES.concat(constants.DECISIONS).indexOf(key) < 0){
                className += ' moveable'
            }
            pData.push({
                'x': x,
                'y': y,
                'name':key,
                'value': val,
                'id': -1,
                'class': className,
                'fill': attentionScale(attentionV),
                'attention': attentionV,
                'radius': getRadius(-1),
            })
        }

        var getFill = (d)=>{return d.fill;}

        function getOpacity(d){
            if(d.id === -1){
                return 1;
            }
            return .7;
        }

        
        svg.selectAll('.patientMarker').remove();
        let pCircles = svg.selectAll('.patientMarker')
            .data(pData).enter()
            .append('circle').attr('class',d=>d.class)
            .attr('id',d=>d.name.replace(' ','_'))
            .attr('cx',d=>d.x)
            .attr('cy',d=>d.y)
            .attr('r',d=>d.radius)
            .attr('fill',getFill)
            .attr('opacity',getOpacity)
            .attr('stroke','black')
            .attr('cursor',d=> d.class.includes('moveable')? 'pointer':'')
            .attr('stroke-width',1);

        svg.selectAll('.patientMarker').raise()
        svg.selectAll('.mainPatient').raise();
        updateSliderCallbacks();
         
    }

    function updateSliderCallbacks(){
        var dragHandler = d3.drag()
            .on('drag',function(e,d){
                let scale = varScales[d.name];
                let px  = e.x;
                let newX = Math.min(Math.max(xMargin+textSpacing,px),width-xMargin);
                let newVal = scale.invert(newX);
                let duration = 1;
                if(booleanVars.indexOf(d.name) > -1){
                    newVal = newVal > .5;
                    newX = scale(newVal);
                    duration = 200;
                } else if(ordinalVars[d.name] !== undefined){
                    newVal = Math.round(newVal);
                    duration = 100;
                }
                d3.select(this)
                    .transition()
                    .duration(duration)
                    .attr('cx',newX);
                tTip.html(d.name +': ' + newVal)
                Utils.moveTTip(tTip,newX+d.radius,e.y);
            }).on('end',function(e,d){
                let scale = varScales[d.name];
                let px  = e.x;
                let newX = Math.min(Math.max(xMargin+textSpacing,px),width-xMargin);
                let newVal = scale.invert(newX);
                const isResponse = constants.progressionVars[d.name] !== undefined
                if(booleanVars.indexOf(d.name) > -1){
                    newVal = newVal > .5;
                    newX= scale(newVal);
                } else if(isResponse | ordinalVars[d.name] !== undefined | d.name === 'hpv'){
                    newVal = Math.round(newVal);
                    newX = scale(newVal);
                } 
                let fQue = Object.assign({},props.featureQue);
                if(ordinalVars[d.name] !== undefined){
                    for(let val of ordinalVars[d.name]){
                        fQue[d.name+'_'+val] = (val == newVal) + 0;
                    }
                } else if(isResponse){
                    let names = constants.progressionVars[d.name];
                    for(let i in names){
                        let n = names[i];
                        fQue[n] = (Math.abs(i - newVal) < .001)? 1: 0;
                    }
                } else{
                    let oldVal = d.value;
                    if(Math.abs(oldVal - newVal) > .00001){
                        fQue[d.name] = newVal;
                    }
                }
                if(isResponse){
                    console.log(fQue,d.name,newVal);
                }
                d3.select(this)
                    .attr('cx',newX)
                props.setFeatureQue(fQue);
                Utils.hideTTip(tTip);
        });

        let mP = svg.selectAll('.patientMarker');
        if(!mP.empty()){
            mP.on('mouseover',function(e,d){
                let attention = d.attention === undefined? 'NA': d.attention.toFixed(3);
                let string = d.name + ': ' + d.value;
                tTip.html(string);
                Utils.moveTTip(tTip,d.x+d.radius,e.y-d.radius);
            }).on('mouseout', function(e){
                Utils.hideTTip(tTip);
            })
            mP.filter('.moveable').call(dragHandler);
        }
    }



    // useEffect(()=>{
    //     if(svg === undefined){ return;}
    //     if(props.featureQue === undefined | Object.keys(props.featureQue).length < 1){
    //         let points = svg.selectAll('.patientMarker');
    //         if(!points.empty()){
    //             points.transition().duration(200).attr('cy',d=>d.y);
    //         }
    //     }
            
    // },[props.featureQue])

    useEffect(()=>{
        if(props.cohortData !== undefined & svg !== undefined){
            let [s,means] = makeScales(props.cohortData);
            setVarScales(s);
            setMeanVals(means);
            
            const axes = [];
            const markers = [];
            const labels = [];
            const tickFontSize = Math.min(height/50,17);
            const labelFontSize = Math.min(height/40,20);
            for(const [key,scale] of Object.entries(s)){
                if(allVars.indexOf(key) < 0){
                    continue;
                }
                let x0 = xRange[0];
                let x1 = xRange[1];
                let y0 = getY(key);
                let y1 = getY(key);
                let line = d3.line()([[x0,y0],[x1,y1]]);
                axes.push({
                    'path': line,
                    'name': key,
                    'domain': scale.domain(),
                    'xText':(x0 + x1)/2,
                    'yText': y0 - getRadius(-1) - tickFontSize - 6,
                })
                let xTicks = [x0,x1];
                if(ordinalVars[key] !== undefined){
                    let tRange = constants.ordinalVars[key];
                    xTicks = [];
                    for(let t of tRange){
                        xTicks.push(scale(t));
                    }
                }  else if(continuousVars.indexOf(key) > -1 ){
                    let weights = key === 'hpv'? [0,.5,1]: [0,.25,.5,.75,1];
                    xTicks = weights.map(w => x0*w + (x1*(1-w)));
                } else if(constants.progressionVars[key] !== undefined){
                    let tRange = constants.progressionVars[key].map((d,i)=>i);
                    xTicks = [];
                    for(let t of tRange){
                        xTicks.push(scale(t));
                    }
                }
                for(let xx of xTicks){
                    let val = scale.invert(xx);
                    const trueValue = val+0;
                    if(booleanVars.indexOf(key) > -1){
                        val = val > 0? 'Y':'N';
                    } else if(key == 'hpv'){
                        val = val > 0? 'Y': val < 0? '?':'N';
                    }
                    else if(continuousVars.indexOf(key) > -1){
                        val = (0+val).toFixed(1);
                    }
                    else if(ordinalVars[key] !== undefined){
                        val = val.toFixed(0);
                    } else if(constants.progressionVars[key] !== undefined){
                        val = constants.progressionVars[key][Math.round(val)];
                        val = val.replace('Nodal','').replace('Primary','').replace(' ','');
                    }
                    markers.push({
                        'x': xx,
                        'y': y0,
                        'name': key,
                        'value': trueValue,
                        'text': val,
                    });
                }
            }
            svg.selectAll('.axes').remove();
            svg.selectAll('.axes')
                .data(axes).enter()
                .append('path')
                .attr('class','axes')
                .attr('d',d=>d.path)
                .attr('stroke-width',3)
                .attr('stroke','black')
                .attr('opacity',.1);


            svg.selectAll('.axesTick').remove();
            svg.selectAll('.axesTick')
                .data(markers).enter()
                .append('circle').attr('class','axesTick')
                .attr('cx',d=>d.x)
                .attr('cy',d=>d.y)
                .attr('r',4)
                .attr('fill','white')
                .attr('stroke','gray')
                .attr('cursor','pointer')
                .attr('stroke-width',2)
                .on('click',(e,d)=>{
                    let fQue = Object.assign({},props.featureQue);
                    let newVal = d.value;
                    let oldVal = fQue[d.name];
                    if(newVal !== oldVal){
                        if(ordinalVars[d.name] !== undefined){
                            for(let val of ordinalVars[d.name]){
                                fQue[d.name+'_'+parseInt(val)] = (val == newVal) + 0;
                            }
                        }else{
                            fQue[d.name] = newVal;
                        }
                        let selection = svg.selectAll('.mainPatient').filter('#'+d.name);
                        if(!selection.empty()){
                            console.log('selection',selection)
                            selection.attr('cx',d.x);
                        }
                        props.setFeatureQue(fQue);
                    }
                });
                

            svg.selectAll('.tickText').remove();
            svg.selectAll('.tickText')
                .data(markers).enter()
                .append('text').attr('class','tickText')
                .attr('x',d=>d.x)
                .attr('text-anchor','middle')
                .attr('y',d=>d.y - getRadius(-1))
                .attr('font-size',tickFontSize)
                .text(d=>d.text);

            svg.selectAll('.axesText').remove();
            svg.selectAll('.axesText')
                .data(axes).enter()
                .append('text').attr('class','axesText')
                .attr('font-size',labelFontSize)
                .attr('x',d=>d.xText).attr('y',d=>d.yText)
                .attr('text-anchor','middle')
                .attr('alignment-baseline','middle')
                .text(d=>Utils.getFeatureDisplayName(d.name));

        }
    },[props.cohortData,svg,props.currState]) 

    useEffect(()=>{
        if(svg!== undefined){
            svg.selectAll('.axesTick')
            .on('click',(e,d)=>{
                let fQue = Object.assign({},props.featureQue);
                let newVal = d.value;
                let oldVal = fQue[d.name];
                if(newVal !== oldVal){
                    if(ordinalVars[d.name] !== undefined){
                        for(let val of ordinalVars[d.name]){
                            fQue[d.name+'_'+parseInt(val)] = (val == newVal) + 0;
                        }
                    }else{
                        fQue[d.name] = newVal;
                    }
                    console.log('selection',d.name.replace(' ','_'))
                    let selection = svg.selectAll('.mainPatient').filter('#'+d.name.replace(' ','_'));
                    if(!selection.empty()){
                        
                        selection.attr('cx',d.x);
                    }
                    props.setFeatureQue(fQue);
                }
            });
        }
    },[svg,props.featureQue])

    useEffect(()=>{
        if(!Utils.allValid([svg,props.patientFeatures,
            props.currEmbeddings,
            props.simulation,
            varScales])){return}
        makePanel()
    },[props.patientFeatures,
        svg,
        props.simulation,
        allVars,
        props.fixedDecisions,
        props.brushedId,
        props.currState,props.modelOutput,
        props.currEmbeddings,varScales])

    useEffect(()=>{
        if(Utils.allValid([svg,varScales])){
            updateSliderCallbacks();
        }
    },[props.featureQue,svg,varScales]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}