// Floor plans of WISS Zürich, measured from photos of the info boards (2.OG and 4.OG).
// Units = pixels of the original 2576×1190 photos. Neighbouring rooms share exact wall
// coordinates, so nothing overlaps and rooms meet the outer wall precisely.
//   r: [x, y, w, h]  rectangle      p: [[x,y], …]  polygon (non-rectangular rooms), c: label position
//   id: bookable Tocco room (live status colours) · label '|' = line break
window.FLOORPLANS = {
  'WISS Zürich': {
    '2.OG': {
      view: [420, 177, 1275, 823],
      outline: [[440, 425], [1165, 425], [1165, 197], [1605, 197], [1605, 565], [1675, 565], [1675, 915], [1595, 915], [1595, 980], [440, 980]],
      rooms: [
        // wing (north)
        { id: 'ZH-208', label: '2.08', r: [1165, 197, 160, 228] },
        { label: '2.09', r: [1325, 197, 125, 103] },
        { label: '', r: [1340, 300, 45, 100], kind: 'service' },
        { label: '', r: [1405, 300, 45, 100], kind: 'service' },
        { label: '2.10', r: [1450, 197, 155, 238] },
        { label: '2.11', r: [1422, 475, 183, 88] },
        { id: 'ZH-212', label: '2.12', r: [1422, 605, 253, 100] },
        // north row
        { id: 'ZH-205', label: '2.05', r: [440, 425, 165, 190] },
        { id: 'ZH-206', label: '2.06', r: [605, 425, 252, 137] },
        { label: '2.07', r: [857, 425, 203, 137] },
        { label: 'Kurs-|leitung', r: [1060, 425, 140, 125], kind: 'office' },
        { label: 'Drucker', r: [1200, 472, 130, 78], kind: 'service' },
        // west
        { label: '2.04', r: [440, 615, 159, 185] },
        // south row
        { id: 'ZH-203', label: '2.03', r: [440, 800, 216, 180] },
        { id: 'ZH-202', label: '2.02', r: [656, 800, 203, 180] },
        { id: 'ZH-201', label: '2.01', r: [859, 805, 201, 175] },
        { label: 'Empfang', r: [1060, 822, 183, 158], kind: 'office' },
        { label: 'Schulleitung|Höhere BB', r: [1243, 822, 197, 158], kind: 'office' },
        { label: 'Schulleitung|Grundbildung', r: [1440, 822, 155, 158], kind: 'office' }
      ],
      areas: [
        { label: 'Treppe|Lift', r: [599, 617, 186, 119], kind: 'core' },
        { label: 'WC', r: [855, 562, 97, 135], kind: 'core' },
        { label: 'Treppe · Lift|WC', r: [990, 562, 340, 178], kind: 'core' },
        { label: 'Verpflegung', r: [1330, 705, 345, 117], kind: 'lounge' }
      ]
    },
    '4.OG': {
      view: [495, 162, 1395, 896],
      outline: [[515, 562], [1310, 562], [1310, 182], [1792, 182], [1792, 582], [1870, 582], [1870, 965], [1620, 965], [1620, 1038], [515, 1038]],
      terrace: [674, 508, 373, 54],
      rooms: [
        // wing (north)
        { id: 'ZH-409', label: '4.09', p: [[1310, 182], [1485, 182], [1485, 297], [1507, 297], [1507, 402], [1310, 402]], c: [1400, 292] },
        { label: '4.10', r: [1485, 182, 137, 115] },
        { id: 'ZH-411', label: '4.11', p: [[1622, 182], [1792, 182], [1792, 400], [1585, 400], [1585, 297], [1622, 297]], c: [1700, 292] },
        { id: 'ZH-408', label: '4.08', r: [1310, 402, 170, 160] },
        { id: 'ZH-412', label: '4.12', r: [1617, 440, 175, 150] },
        { id: 'ZH-413', label: '4.13', r: [1583, 590, 287, 152] },
        { id: 'ZH-414', label: '4.14', r: [1583, 742, 287, 183] },
        { label: '4.15', p: [[1400, 867], [1583, 867], [1583, 925], [1620, 925], [1620, 1038], [1400, 1038]], c: [1505, 958] },
        // north row
        { id: 'ZH-404', label: '4.04', r: [515, 562, 173, 282] },
        { label: '4.05', r: [688, 562, 157, 88] },
        { label: '4.06', r: [917, 562, 103, 168] },
        // south row
        { id: 'ZH-403', label: '4.03', r: [515, 844, 240, 194] },
        { id: 'ZH-402', label: '4.02', r: [755, 844, 223, 194] },
        { id: 'ZH-401', label: '4.01', r: [978, 850, 224, 188] }
      ],
      areas: [
        { label: 'Treppe|Lift', r: [688, 650, 197, 130], kind: 'core' },
        { label: 'WC', r: [1020, 562, 102, 168], kind: 'core' },
        { label: 'Treppe · Lift · WC', r: [1122, 565, 356, 215], kind: 'core' },
        { label: 'Aufenthalt', r: [1202, 867, 198, 171], kind: 'lounge' }
      ]
    }
  }
};
