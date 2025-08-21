// static/js/seatLayout.js

// Notice: the keys now read "32 Seater", "46 Seater", "52 Seater", "60 Seater" exactly
export const seatLayouts = {
  "32 - Seater": {
    rows: 5,
    columns: 9,  // 2 seats / aisle / 2 seats
    seats: [
      // Row 1



      { id: "4", row: 1, col: 3 },
      { id: "7", row: 1, col: 4 },
      { id: "11", row: 1, col: 5 },
      { id: "15", row: 1, col: 6 },
      { id: "19", row: 1, col: 7 },
      { id: "23", row: 1, col: 8 },
      { id: "27", row: 1, col: 9 },
      { id: "31", row: 1, col: 10 },


      // Row 2


      { id: "3", row: 2, col: 3 },
      { id: "6", row: 2, col: 4 },
      { id: "10", row: 2, col: 5 },
      { id: "14", row: 2, col: 6 },
      { id: "18", row: 2, col: 7 },
      { id: "22", row: 2, col: 8 },
      { id: "26", row: 2, col: 9 },
      { id: "30", row: 2, col: 10 },

      // Row 3

      { id: "5", row: 3, col: 4 },
      { id: "9", row: 3, col: 5 },
      { id: "13", row: 3, col: 6 },
      { id: "1", row: 3, col: 7 },
      { id: "21", row: 3, col: 8 },
      { id: "25", row: 3, col: 9 },
      { id: "29", row: 3, col: 10 },

      // Row 4

      { id: "1", row: 4, col: 2 },
      { id: "2", row: 4, col: 3 },
      { id: "8", row: 4, col: 5 },
      { id: "12", row: 4, col: 6 },
      { id: "16", row: 4, col: 7 },
      { id: "20", row: 4, col: 8 },
      { id: "24", row: 4, col: 9 },
      { id: "28", row: 4, col: 10 },

      // Row 5




    ]
  },

  "22 - Seater": {
    rows: 5,
    columns: 9,  // 2 seats / aisle / 2 seats
    seats: [
      // Row 1


      { id: "4", row: 1, col: 3 },
      { id: "8", row: 1, col: 4 },
      { id: "12", row: 1, col: 5 },
      { id: "16", row: 1, col: 6 },
      { id: "20", row: 1, col: 7 },
      { id: "24", row: 1, col: 8 },



      // Row 2


      { id: "3", row: 2, col: 3 },
      { id: "7", row: 2, col: 4 },
      { id: "11", row: 2, col: 5 },
      { id: "15", row: 2, col: 6 },
      { id: "19", row: 2, col: 7 },
      { id: "23", row: 2, col: 8 },


      // Row 3

      { id: "6", row: 3, col: 4 },
      { id: "10", row: 3, col: 5 },
      { id: "14", row: 3, col: 6 },
      { id: "18", row: 3, col: 7 },
      { id: "22", row: 3, col: 8 },


      // Row 4

      { id: "1", row: 4, col: 2 },
      { id: "2", row: 4, col: 3 },
      { id: "5", row: 4, col: 4 },
      { id: "9", row: 4, col: 5 },
      { id: "13", row: 4, col: 6 },
      { id: "17", row: 4, col: 7 },
      { id: "21", row: 4, col: 8 },






    ]
  },

  "55 - Seater": {
    rows: 5,
    columns: 9,  // 2 seats / aisle / 2 seats
    seats: [
      // Row 1
      { id: "4", row: 1, col: 3 },
      { id: "7", row: 1, col: 4 },
      { id: "11", row: 1, col: 5 },
      { id: "15", row: 1, col: 6 },
      { id: "19", row: 1, col: 7 },
      { id: "23", row: 1, col: 8 },
      { id: "27", row: 1, col: 9 },
      { id: "31", row: 1, col: 10 },


      // Row 2


      { id: "3", row: 2, col: 3 },
      { id: "6", row: 2, col: 4 },
      { id: "10", row: 2, col: 5 },
      { id: "14", row: 2, col: 6 },
      { id: "18", row: 2, col: 7 },
      { id: "22", row: 2, col: 8 },
      { id: "26", row: 2, col: 9 },
      { id: "30", row: 2, col: 10 },

      // Row 3

      { id: "5", row: 3, col: 4 },
      { id: "9", row: 3, col: 5 },
      { id: "13", row: 3, col: 6 },
      { id: "17", row: 3, col: 7 },
      { id: "21", row: 3, col: 8 },
      { id: "25", row: 3, col: 9 },
      { id: "29", row: 3, col: 10 },

      // Row 4

      { id: "1", row: 4, col: 2 },
      { id: "2", row: 4, col: 3 },
      { id: "8", row: 4, col: 5 },
      { id: "12", row: 4, col: 6 },
      { id: "16", row: 4, col: 7 },
      { id: "20", row: 4, col: 8 },
      { id: "24", row: 4, col: 9 },
      { id: "28", row: 4, col: 10 },



    ]
  },


  " - Seater": {
    rows: 13,
    columns: 5,
    seats: [
      // … exactly 52 seat objects in the same 2/aisle/2 pattern, e.g.:
      { id: "1A", row: 1, col: 1 },
      { id: "1B", row: 1, col: 2 },
      { id: "1C", row: 1, col: 4 },
      { id: "1D", row: 1, col: 5 },

      { id: "2A", row: 2, col: 1 },
      { id: "2B", row: 2, col: 2 },
      { id: "2C", row: 2, col: 4 },
      { id: "2D", row: 2, col: 5 },

      // … continue all the way through …
      { id: "13A", row: 13, col: 1 },
      { id: "13B", row: 13, col: 2 },
      { id: "13C", row: 13, col: 4 },
      { id: "13D", row: 13, col: 5 }
    ]
  },

  "60 - Seater": {
    rows: 15,
    columns: 5,
    seats: [
      { id: "1A", row: 1, col: 1 },
      { id: "1B", row: 1, col: 2 },
      { id: "1C", row: 1, col: 4 },
      { id: "1D", row: 1, col: 5 },

      { id: "2A", row: 2, col: 1 },
      { id: "2B", row: 2, col: 2 },
      { id: "2C", row: 2, col: 4 },
      { id: "2D", row: 2, col: 5 },

      { id: "3A", row: 3, col: 1 },
      { id: "3B", row: 3, col: 2 },
      { id: "3C", row: 3, col: 4 },
      { id: "3D", row: 3, col: 5 },

      { id: "4A", row: 4, col: 1 },
      { id: "4B", row: 4, col: 2 },
      { id: "4C", row: 4, col: 4 },
      { id: "4D", row: 4, col: 5 },

      { id: "5A", row: 5, col: 1 },
      { id: "5B", row: 5, col: 2 },
      { id: "5C", row: 5, col: 4 },
      { id: "5D", row: 5, col: 5 },

      { id: "6A", row: 6, col: 1 },
      { id: "6B", row: 6, col: 2 },
      { id: "6C", row: 6, col: 4 },
      { id: "6D", row: 6, col: 5 },

      { id: "7A", row: 7, col: 1 },
      { id: "7B", row: 7, col: 2 },
      { id: "7C", row: 7, col: 4 },
      { id: "7D", row: 7, col: 5 },

      { id: "8A", row: 8, col: 1 },
      { id: "8B", row: 8, col: 2 },
      { id: "8C", row: 8, col: 4 },
      { id: "8D", row: 8, col: 5 },

      { id: "9A", row: 9, col: 1 },
      { id: "9B", row: 9, col: 2 },
      { id: "9C", row: 9, col: 4 },
      { id: "9D", row: 9, col: 5 },

      { id: "10A", row: 10, col: 1 },
      { id: "10B", row: 10, col: 2 },
      { id: "10C", row: 10, col: 4 },
      { id: "10D", row: 10, col: 5 },

      { id: "11A", row: 11, col: 1 },
      { id: "11B", row: 11, col: 2 },
      { id: "11C", row: 11, col: 4 },
      { id: "11D", row: 11, col: 5 },

      { id: "12A", row: 12, col: 1 },
      { id: "12B", row: 12, col: 2 },
      { id: "12C", row: 12, col: 4 },
      { id: "12D", row: 12, col: 5 },

      { id: "13A", row: 13, col: 1 },
      { id: "13B", row: 13, col: 2 },
      { id: "13C", row: 13, col: 4 },
      { id: "13D", row: 13, col: 5 },

      { id: "14A", row: 14, col: 1 },
      { id: "14B", row: 14, col: 2 },
      { id: "14C", row: 14, col: 4 },
      { id: "14D", row: 14, col: 5 },

      { id: "15A", row: 15, col: 1 },
      { id: "15B", row: 15, col: 2 },
      { id: "15C", row: 15, col: 4 },
      { id: "15D", row: 15, col: 5 }
    ]
  }
};
