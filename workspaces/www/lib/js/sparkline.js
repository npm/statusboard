// Forked from https://github.com/fnando/sparkline
// MIT License

// Copyright (c) 2018 Nando Vieira

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

function getY (max, height, diff, value) {
  return max === 0 ? height : parseFloat((height - (value * height / max) + diff).toFixed(2))
}

function removeChildren (svg) {
  [...svg.querySelectorAll('*')].forEach(element => svg.removeChild(element))
}

function buildElement (tag, attrs) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag)

  for (const name in attrs) {
    element.setAttribute(name, attrs[name])
  }

  return element
}

export default (svg, values, options = {}) => {
  removeChildren(svg)

  const {
    onmousemove,
    onmouseout,
    // Define how big should be the spot area.
    spotRadius = 2,
    // Define how wide should be the cursor area.
    cursorWidth = 2,
  } = options

  const spotDiameter = spotRadius * 2

  // Get the stroke width; this is used to compute the
  // rendering offset.
  const strokeWidth = parseFloat(svg.attributes['stroke-width'].value)

  // The rendering width will account for the spot size.
  const width = parseFloat(svg.attributes.width.value) - spotDiameter * 2

  // Get the SVG element's full height.
  // This is used
  const fullHeight = parseFloat(svg.attributes.height.value)

  // The rendering height accounts for stroke width and spot size.
  const height = fullHeight - (strokeWidth * 2) - spotDiameter

  // The maximum value. This is used to calculate the Y coord of
  // each sparkline datapoint.
  const max = Math.max(...values) || 0

  // Some arbitrary value to remove the cursor and spot out of
  // the viewing canvas.
  const offscreen = -1000

  // Cache the last item index.
  const lastItemIndex = values.length - 1

  // Calculate the X coord base step.
  const offset = width / lastItemIndex

  // Hold all datapoints, which is whatever we got as the entry plus
  // x/y coords and the index.
  const datapoints = []

  // The first non null value determines the initial offset
  const firstValueIndex = values.findIndex(v => v != null)
  const initialOffset = spotDiameter + firstValueIndex * offset

  // Hold the line coordinates. Handles leadings nulls
  const pathY = getY(max, height, strokeWidth + spotRadius, values[firstValueIndex])
  let pathCoords = `M${initialOffset} ${pathY}`

  values.forEach((value, index) => {
    const x = index * offset + spotDiameter
    const y = getY(max, height, strokeWidth + spotRadius, value)

    datapoints.push({
      index,
      value,
      x: x,
      y: y,
    })

    if (value === null) {
      return
    }

    pathCoords += ` L ${x} ${y}`
  })

  const path = buildElement('path', {
    class: 'sparkline--line',
    d: pathCoords,
    fill: 'none',
  })

  const fillCoords = `${pathCoords} V ${fullHeight} L ${initialOffset} ${fullHeight} Z`

  const fill = buildElement('path', {
    class: 'sparkline--fill',
    d: fillCoords,
    stroke: 'none',
  })

  svg.appendChild(fill)
  svg.appendChild(path)

  const cursor = buildElement('line', {
    class: 'sparkline--cursor',
    x1: offscreen,
    x2: offscreen,
    y1: 0,
    y2: fullHeight,
    'stroke-width': cursorWidth,
  })

  const spot = buildElement('circle', {
    class: 'sparkline--spot',
    cx: offscreen,
    cy: offscreen,
    r: spotRadius,
  })

  svg.appendChild(cursor)
  svg.appendChild(spot)

  const interactionLayer = buildElement('rect', {
    width: svg.attributes.width.value,
    height: svg.attributes.height.value,
    style: 'fill: transparent; stroke: transparent',
    class: 'sparkline--interaction-layer',
  })
  svg.appendChild(interactionLayer)

  interactionLayer.addEventListener('mouseout', event => {
    cursor.setAttribute('x1', offscreen)
    cursor.setAttribute('x2', offscreen)

    spot.setAttribute('cx', offscreen)

    onmouseout(event)
  })

  interactionLayer.addEventListener('mousemove', event => {
    const mouseX = event.offsetX

    let nextDataPoint = datapoints.find(entry => {
      return entry.x >= mouseX
    })

    if (!nextDataPoint) {
      nextDataPoint = datapoints[lastItemIndex]
    }

    const previousDataPoint = datapoints[datapoints.indexOf(nextDataPoint) - 1]
    let currentDataPoint
    let halfway

    if (previousDataPoint) {
      halfway = previousDataPoint.x + ((nextDataPoint.x - previousDataPoint.x) / 2)
      currentDataPoint = mouseX >= halfway ? nextDataPoint : previousDataPoint
    } else {
      currentDataPoint = nextDataPoint
    }

    const { x, y } = currentDataPoint

    spot.setAttribute('cx', x)
    spot.setAttribute('cy', y)

    cursor.setAttribute('x1', x)
    cursor.setAttribute('x2', x)

    onmousemove(event, currentDataPoint)
  })
}
